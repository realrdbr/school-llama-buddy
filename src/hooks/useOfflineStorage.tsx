import { useState, useEffect } from 'react';

interface OfflineData {
  [key: string]: {
    data: any;
    timestamp: number;
    expiry?: number;
  };
}

export const useOfflineStorage = () => {
  const [offlineData, setOfflineData] = useState<OfflineData>({});

  // Load data from IndexedDB on mount
  useEffect(() => {
    loadFromIndexedDB();
  }, []);

  const saveData = async (key: string, data: any, expiryMinutes = 60) => {
    const timestamp = Date.now();
    const expiry = timestamp + (expiryMinutes * 60 * 1000);
    
    const item = {
      data,
      timestamp,
      expiry
    };

    // Update state
    setOfflineData(prev => ({
      ...prev,
      [key]: item
    }));

    // Save to IndexedDB
    try {
      await saveToIndexedDB(key, item);
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
      // Fallback to localStorage
      localStorage.setItem(`offline_${key}`, JSON.stringify(item));
    }
  };

  const getData = async (key: string): Promise<any | null> => {
    // Check memory first
    const memoryData = offlineData[key];
    if (memoryData && (memoryData.expiry && Date.now() < memoryData.expiry)) {
      return memoryData.data;
    }

    // Check IndexedDB
    try {
      const dbData = await getFromIndexedDB(key);
      if (dbData && (!dbData.expiry || Date.now() < dbData.expiry)) {
        // Update memory
        setOfflineData(prev => ({
          ...prev,
          [key]: dbData
        }));
        return dbData.data;
      }
    } catch (error) {
      console.error('Failed to get from IndexedDB:', error);
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem(`offline_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!parsed.expiry || Date.now() < parsed.expiry) {
            return parsed.data;
          }
        }
      } catch (error) {
        console.error('Failed to get from localStorage:', error);
      }
    }

    return null;
  };

  const clearExpiredData = async () => {
    const now = Date.now();
    const updatedData = { ...offlineData };
    
    Object.keys(updatedData).forEach(key => {
      const item = updatedData[key];
      if (item.expiry && now > item.expiry) {
        delete updatedData[key];
        deleteFromIndexedDB(key);
      }
    });
    
    setOfflineData(updatedData);
  };

  return {
    saveData,
    getData,
    clearExpiredData,
    hasData: (key: string) => !!offlineData[key]
  };
};

// IndexedDB helpers
const DB_NAME = 'SchoolAppOffline';
const DB_VERSION = 1;
const STORE_NAME = 'offlineData';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const saveToIndexedDB = async (key: string, data: any): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.put(data, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const getFromIndexedDB = async (key: string): Promise<any | null> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

const deleteFromIndexedDB = async (key: string): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const loadFromIndexedDB = async (): Promise<OfflineData> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve) => {
      const data: OfflineData = {};
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          data[cursor.key as string] = cursor.value;
          cursor.continue();
        } else {
          resolve(data);
        }
      };
      
      request.onerror = () => resolve({});
    });
  } catch (error) {
    console.error('Failed to load from IndexedDB:', error);
    return {};
  }
};