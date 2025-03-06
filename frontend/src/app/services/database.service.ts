import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';

declare const window: any;

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  constructor() { }

  query<T>(sql: string, params: any[] = []): Observable<T[]> {
    return from(window.electron.ipcRenderer.invoke('db-query', sql, params));
  }

  run(sql: string, params: any[] = []): Observable<{ lastID: number, changes: number }> {
    return from(window.electron.ipcRenderer.invoke('db-run', sql, params));
  }

  // Example method to create tables
  async initializeTables(): Promise<void> {
    // Add your table creation queries here
    const createTableQueries = [
      `CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        set_name TEXT,
        collector_number TEXT,
        image_uri TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      // Add more table creation queries as needed
    ];

    for (const query of createTableQueries) {
      await this.run(query).toPromise();
    }
  }
} 