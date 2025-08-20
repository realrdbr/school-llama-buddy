import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, data } = await req.json()
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let result = {}

    switch (action) {
      case 'store_schedule':
        // Store persistent class schedule
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('class_schedules')
          .upsert({
            class_name: data.className,
            day_of_week: data.dayOfWeek,
            period: data.period,
            subject: data.subject,
            teacher: data.teacher,
            room: data.room,
            start_time: data.startTime,
            end_time: data.endTime,
            updated_at: new Date().toISOString()
          })
          .select()

        if (scheduleError) throw scheduleError
        result = { success: true, schedule: scheduleData }
        break

      case 'get_schedule':
        // Retrieve class schedule
        const { data: allSchedules, error: getError } = await supabase
          .from('class_schedules')
          .select('*')
          .eq('class_name', data.className)
          .order('day_of_week, period')

        if (getError) throw getError
        result = { success: true, schedules: allSchedules }
        break

      case 'find_affected_lessons':
        // Find lessons affected by teacher absence
        const { data: affectedLessons, error: affectedError } = await supabase
          .from('class_schedules')
          .select('*')
          .eq('teacher', data.teacherName)
          .eq('day_of_week', data.dayOfWeek)

        if (affectedError) throw affectedError
        result = { success: true, affected_lessons: affectedLessons }
        break

      case 'find_substitute_teacher':
        // Find suitable substitute teacher
        const { data: teachers, error: teachersError } = await supabase
          .from('teachers')
          .select('*')

        if (teachersError) throw teachersError

        // Get existing substitutions for the day to check availability
        const { data: existingSubstitutions, error: subError } = await supabase
          .from('vertretungsplan')
          .select('substitute_teacher, period')
          .eq('date', data.date)

        if (subError) throw subError

        // Find best substitute based on subject expertise and availability
        const availableTeachers = teachers.filter(teacher => {
          // Skip the absent teacher
          if (teacher.name === data.absentTeacher) return false
          
          // Check if teacher is already assigned during this period
          const isAlreadyAssigned = existingSubstitutions.some(sub => 
            sub.substitute_teacher === teacher.name && sub.period === data.period
          )
          
          return !isAlreadyAssigned
        })

        // Prioritize teachers by subject match and preferred room
        const bestSubstitute = availableTeachers.find(teacher => 
          teacher.subjects?.includes(data.subject) && 
          teacher.preferred_rooms?.includes(data.room)
        ) || availableTeachers.find(teacher => 
          teacher.subjects?.includes(data.subject)
        ) || availableTeachers[0]

        result = { 
          success: true, 
          substitute: bestSubstitute,
          available_teachers: availableTeachers.length 
        }
        break

      case 'create_substitution_plan':
        // Create comprehensive substitution plan for teacher absence
        const teacherName = data.teacherName
        const absenceDate = data.date
        
        // Get day of week for the date
        const date = new Date(absenceDate)
        const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay() // Convert Sunday=0 to Sunday=7
        
        // Find all lessons for this teacher on this day
        const { data: teacherLessons, error: lessonsError } = await supabase
          .from('class_schedules')
          .select('*')
          .eq('teacher', teacherName)
          .eq('day_of_week', dayOfWeek)

        if (lessonsError) throw lessonsError

        // Get all available teachers
        const { data: allTeachers, error: allTeachersError } = await supabase
          .from('teachers')
          .select('*')

        if (allTeachersError) throw allTeachersError

        // Get existing substitutions for conflict checking
        const { data: existingSubs, error: existingSubsError } = await supabase
          .from('vertretungsplan')
          .select('substitute_teacher, period')
          .eq('date', absenceDate)

        if (existingSubsError) throw existingSubsError

        const substitutionPlan = []

        for (const lesson of teacherLessons) {
          // Find best substitute
          const availableForPeriod = allTeachers.filter(teacher => {
            if (teacher.name === teacherName) return false
            
            const isAlreadyAssigned = existingSubs.some(sub => 
              sub.substitute_teacher === teacher.name && sub.period === lesson.period
            )
            
            return !isAlreadyAssigned
          })

          let bestSubstitute = null
          let substituteReason = "Keine Vertretung verfügbar"

          if (availableForPeriod.length > 0) {
            // Priority 1: Same subject + preferred room
            bestSubstitute = availableForPeriod.find(teacher => 
              teacher.subjects?.includes(lesson.subject) && 
              teacher.preferred_rooms?.includes(lesson.room)
            )
            
            // Priority 2: Same subject
            if (!bestSubstitute) {
              bestSubstitute = availableForPeriod.find(teacher => 
                teacher.subjects?.includes(lesson.subject)
              )
            }
            
            // Priority 3: Any available teacher
            if (!bestSubstitute) {
              bestSubstitute = availableForPeriod[0]
            }

            if (bestSubstitute) {
              substituteReason = `Vertretung durch ${bestSubstitute.name}`
              
              // Add to existing substitutions to prevent double-booking
              existingSubs.push({
                substitute_teacher: bestSubstitute.name,
                period: lesson.period
              })
            }
          }

          substitutionPlan.push({
            class_name: lesson.class_name,
            period: lesson.period,
            original_teacher: teacherName,
            original_subject: lesson.subject,
            original_room: lesson.room,
            substitute_teacher: bestSubstitute?.name || "Entfall",
            substitute_subject: bestSubstitute ? lesson.subject : "Entfall",
            substitute_room: bestSubstitute ? 
              (bestSubstitute.preferred_rooms?.[0] || lesson.room) : 
              lesson.room,
            note: substituteReason,
            start_time: lesson.start_time,
            end_time: lesson.end_time
          })
        }

        result = { 
          success: true, 
          substitution_plan: substitutionPlan,
          affected_lessons_count: teacherLessons.length
        }
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Schedule Manager Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})