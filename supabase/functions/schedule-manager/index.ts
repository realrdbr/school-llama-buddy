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
        // Not implemented - schedule data is stored in pre-defined tables
        result = { success: false, error: 'Schedule storage not implemented - use direct table access' }
        break

      case 'get_schedule':
        // Retrieve class schedule from the correct table
        const scheduleTableName = `Stundenplan_${data.className}_A`;
        const { data: allSchedules, error: getError } = await supabase
          .from(scheduleTableName)
          .select('*')
          .order('Stunde')

        if (getError) throw getError
        result = { success: true, schedules: allSchedules }
        break

      case 'find_affected_lessons':
        // Find lessons affected by teacher absence across all class tables
        const classTableNames = ['Stundenplan_10b_A', 'Stundenplan_10c_A'];
        const allAffectedLessons = [];
        
        for (const tableName of classTableNames) {
          const { data: classLessons, error: classError } = await supabase
            .from(tableName)
            .select('*');
            
          if (!classError && classLessons) {
            // Parse lessons to find teacher matches
            const dayColumns = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            classLessons.forEach(lesson => {
              dayColumns.forEach((day, dayIndex) => {
                const lessonContent = lesson[day];
                if (lessonContent && lessonContent.includes(data.teacherName)) {
                  allAffectedLessons.push({
                    class_name: tableName.replace('Stundenplan_', '').replace('_A', ''),
                    period: lesson.Stunde,
                    day_of_week: dayIndex + 1,
                    teacher: data.teacherName,
                    content: lessonContent
                  });
                }
              });
            });
          }
        }
        
        result = { success: true, affected_lessons: allAffectedLessons }
        break

      case 'find_substitute_teacher':
        // Find suitable substitute teacher using correct table structure
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
          // Skip the absent teacher (check both shortened and full name)
          const teacherFullName = `${teacher['first name']} ${teacher['last name']}`;
          if (teacherFullName === data.absentTeacher || teacher.shortened === data.absentTeacher) return false
          
          // Check if teacher is already assigned during this period
          const isAlreadyAssigned = existingSubstitutions.some(sub => 
            sub.substitute_teacher === teacher.shortened && sub.period === data.period
          )
          
          return !isAlreadyAssigned
        })

        // Prioritize teachers by subject match and preferred room
        const bestSubstitute = availableTeachers.find(teacher => 
          teacher.subjects?.toLowerCase().includes(data.subject?.toLowerCase()) && 
          teacher.fav_rooms?.includes(data.room)
        ) || availableTeachers.find(teacher => 
          teacher.subjects?.toLowerCase().includes(data.subject?.toLowerCase())
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
        const dayColumns = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', '', ''];
        const targetDayColumn = dayColumns[dayOfWeek];
        
        if (!targetDayColumn) {
          result = { success: true, substitution_plan: [], affected_lessons_count: 0 };
          break;
        }
        
        // Find all lessons for this teacher on this day across all class tables
        const classTableNames = ['Stundenplan_10b_A', 'Stundenplan_10c_A'];
        const teacherLessons = [];
        
        for (const tableName of classTableNames) {
          const { data: classSchedule, error: scheduleError } = await supabase
            .from(tableName)
            .select('*');
            
          if (!scheduleError && classSchedule) {
            classSchedule.forEach(lesson => {
              const lessonContent = lesson[targetDayColumn];
              if (lessonContent && lessonContent.toLowerCase().includes(teacherName.toLowerCase())) {
                // Parse lesson content to extract subject and room
                const parts = lessonContent.split(/[\s,/|]+/).filter(p => p.trim());
                let subject = 'Unbekannt';
                let room = 'Unbekannt';
                
                // Find subject (usually first part or recognizable abbreviation)
                for (const part of parts) {
                  if (part.length >= 2 && part.length <= 4 && /^[A-Za-z]+$/.test(part)) {
                    if (!part.toLowerCase().includes(teacherName.toLowerCase())) {
                      subject = part;
                      break;
                    }
                  }
                }
                
                // Find room (numbers or number+letter combinations)
                for (const part of parts) {
                  if (/^\d+[A-Za-z]?$/.test(part) || /^[A-Za-z]\d+$/.test(part)) {
                    room = part;
                    break;
                  }
                }
                
                teacherLessons.push({
                  class_name: tableName.replace('Stundenplan_', '').replace('_A', ''),
                  period: lesson.Stunde,
                  subject: subject,
                  room: room,
                  teacher: teacherName,
                  day_column: targetDayColumn
                });
              }
            });
          }
        }

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
            const teacherFullName = `${teacher['first name']} ${teacher['last name']}`;
            if (teacherFullName === teacherName || teacher.shortened === teacherName) return false
            
            const isAlreadyAssigned = existingSubs.some(sub => 
              sub.substitute_teacher === teacher.shortened && sub.period === lesson.period
            )
            
            return !isAlreadyAssigned
          })

          let bestSubstitute = null
          let substituteReason = "Keine Vertretung verfügbar"

          if (availableForPeriod.length > 0) {
            // Priority 1: Same subject + preferred room  
            bestSubstitute = availableForPeriod.find(teacher => 
              teacher.subjects?.toLowerCase().includes(lesson.subject.toLowerCase()) && 
              teacher.fav_rooms?.includes(lesson.room)
            )
            
            // Priority 2: Same subject
            if (!bestSubstitute) {
              bestSubstitute = availableForPeriod.find(teacher => 
                teacher.subjects?.toLowerCase().includes(lesson.subject.toLowerCase())
              )
            }
            
            // Priority 3: Any available teacher
            if (!bestSubstitute) {
              bestSubstitute = availableForPeriod[0]
            }

            if (bestSubstitute) {
              substituteReason = `Vertretung durch ${bestSubstitute.shortened}`
              
              // Add to existing substitutions to prevent double-booking
              existingSubs.push({
                substitute_teacher: bestSubstitute.shortened,
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
            substitute_teacher: bestSubstitute?.shortened || "Entfall",
            substitute_subject: bestSubstitute ? lesson.subject : "Entfall",
            substitute_room: bestSubstitute ? 
              (bestSubstitute.fav_rooms?.split(',')[0]?.trim() || lesson.room) : 
              lesson.room,
            note: substituteReason
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