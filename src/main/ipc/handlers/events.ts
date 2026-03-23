import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDatabase } from '../../db/database'

export function registerEventHandlers(): void {
  const db = () => getDatabase()

  // ─── ETKİNLİKLER ──────────────────────────────────────────────────────────

  ipcMain.handle('events:getAll', () => {
    return db().prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count,
        (SELECT COUNT(*) FROM event_rehearsals er WHERE er.event_id = e.id) AS rehearsal_count
      FROM events e
      ORDER BY e.event_date DESC
    `).all()
  })

  ipcMain.handle('events:getById', (_e, id: number) => {
    return db().prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count,
        (SELECT COUNT(*) FROM event_rehearsals er WHERE er.event_id = e.id) AS rehearsal_count
      FROM events e WHERE e.id = ?
    `).get(id)
  })

  ipcMain.handle('events:create', (_e, data: Record<string, unknown>) => {
    const params = {
      start_time: null, end_time: null, venue: null, capacity: null,
      ticket_price: 0, is_free: 1, description: null, poster_path: null,
      notes: null, status: 'planning',
      ...data
    }
    const result = db().prepare(`
      INSERT INTO events (name, event_type, event_date, start_time, end_time, venue,
        capacity, ticket_price, is_free, description, poster_path, status, notes)
      VALUES (@name, @event_type, @event_date, @start_time, @end_time, @venue,
        @capacity, @ticket_price, @is_free, @description, @poster_path, @status, @notes)
    `).run(params)
    return db().prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count,
        (SELECT COUNT(*) FROM event_rehearsals er WHERE er.event_id = e.id) AS rehearsal_count
      FROM events e WHERE e.id = ?
    `).get(result.lastInsertRowid)
  })

  ipcMain.handle('events:update', (_e, id: number, data: Record<string, unknown>) => {
    const params = {
      start_time: null, end_time: null, venue: null, capacity: null,
      ticket_price: 0, is_free: 1, description: null, poster_path: null, notes: null,
      ...data, id
    }
    db().prepare(`
      UPDATE events SET name=@name, event_type=@event_type, event_date=@event_date,
        start_time=@start_time, end_time=@end_time, venue=@venue, capacity=@capacity,
        ticket_price=@ticket_price, is_free=@is_free, description=@description,
        poster_path=@poster_path, status=@status, notes=@notes
      WHERE id=@id
    `).run(params)
    return db().prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count,
        (SELECT COUNT(*) FROM event_rehearsals er WHERE er.event_id = e.id) AS rehearsal_count
      FROM events e WHERE e.id = ?
    `).get(id)
  })

  ipcMain.handle('events:delete', (_e, id: number) => {
    db().prepare('DELETE FROM events WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('events:uploadPoster', async (_e, eventId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Afiş Seç',
      filters: [{ name: 'Görseller', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const ext = path.extname(result.filePaths[0])
    const destDir = path.join(app.getPath('userData'), 'event_posters', String(eventId))
    fs.mkdirSync(destDir, { recursive: true })
    const destFile = path.join(destDir, `poster_${Date.now()}${ext}`)
    fs.copyFileSync(result.filePaths[0], destFile)
    db().prepare('UPDATE events SET poster_path = ? WHERE id = ?').run(destFile, eventId)
    return destFile
  })

  // ─── ETKİNLİK KATILIMCILARI ───────────────────────────────────────────────

  ipcMain.handle('event_participants:getByEvent', (_e, eventId: number) => {
    return db().prepare(`
      SELECT ep.*,
        s.first_name || ' ' || s.last_name AS student_name,
        s.phone AS student_phone, s.parent_name, s.parent_phone,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM event_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN instruments i ON ep.instrument_id = i.id
      WHERE ep.event_id = ?
      ORDER BY ep.stage_order, ep.created_at
    `).all(eventId)
  })

  ipcMain.handle('event_participants:add', (_e, data: Record<string, unknown>) => {
    const params = {
      piece_title: null, piece_composer: null, instrument_id: null,
      stage_order: 0, performance_duration: null, is_attended: null, notes: null,
      ...data
    } as Record<string, unknown>
    // Auto stage_order: max + 1
    if (!data.stage_order) {
      const maxRow = db().prepare(
        'SELECT COALESCE(MAX(stage_order),0)+1 AS next FROM event_participants WHERE event_id = ?'
      ).get(params.event_id) as { next: number }
      params.stage_order = maxRow.next
    }
    const result = db().prepare(`
      INSERT OR IGNORE INTO event_participants
        (event_id, student_id, piece_title, piece_composer, instrument_id, stage_order, performance_duration, notes)
      VALUES (@event_id, @student_id, @piece_title, @piece_composer, @instrument_id, @stage_order, @performance_duration, @notes)
    `).run(params)
    return db().prepare(`
      SELECT ep.*, s.first_name || ' ' || s.last_name AS student_name, s.phone AS student_phone,
        s.parent_name, s.parent_phone, i.name AS instrument_name, i.color_code AS instrument_color
      FROM event_participants ep JOIN students s ON ep.student_id = s.id
      LEFT JOIN instruments i ON ep.instrument_id = i.id
      WHERE ep.id = ?
    `).get(result.lastInsertRowid)
  })

  ipcMain.handle('event_participants:update', (_e, id: number, data: Record<string, unknown>) => {
    const params = {
      piece_title: null, piece_composer: null, instrument_id: null,
      performance_duration: null, notes: null,
      ...data, id
    }
    db().prepare(`
      UPDATE event_participants SET
        piece_title=@piece_title, piece_composer=@piece_composer,
        instrument_id=@instrument_id, stage_order=@stage_order,
        performance_duration=@performance_duration, is_attended=@is_attended, notes=@notes
      WHERE id=@id
    `).run(params)
    return db().prepare(`
      SELECT ep.*, s.first_name || ' ' || s.last_name AS student_name,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM event_participants ep JOIN students s ON ep.student_id = s.id
      LEFT JOIN instruments i ON ep.instrument_id = i.id WHERE ep.id = ?
    `).get(id)
  })

  ipcMain.handle('event_participants:remove', (_e, id: number) => {
    db().prepare('DELETE FROM event_participants WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('event_participants:reorder', (_e, _eventId: number, orderedIds: number[]) => {
    const stmt = db().prepare('UPDATE event_participants SET stage_order = ? WHERE id = ?')
    const bulk = db().transaction(() => {
      orderedIds.forEach((id, index) => stmt.run(index + 1, id))
    })
    bulk()
    return { success: true }
  })

  // ─── PROVA TAKVİMİ ────────────────────────────────────────────────────────

  ipcMain.handle('event_rehearsals:getByEvent', (_e, eventId: number) => {
    return db().prepare(`
      SELECT * FROM event_rehearsals WHERE event_id = ? ORDER BY rehearsal_date, start_time
    `).all(eventId)
  })

  ipcMain.handle('event_rehearsals:create', (_e, data: Record<string, unknown>) => {
    const params = { start_time: null, end_time: null, venue: null, notes: null, ...data }
    const result = db().prepare(`
      INSERT INTO event_rehearsals (event_id, rehearsal_date, start_time, end_time, venue, notes)
      VALUES (@event_id, @rehearsal_date, @start_time, @end_time, @venue, @notes)
    `).run(params)
    return db().prepare('SELECT * FROM event_rehearsals WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('event_rehearsals:update', (_e, id: number, data: Record<string, unknown>) => {
    const params = { start_time: null, end_time: null, venue: null, notes: null, ...data, id }
    db().prepare(`
      UPDATE event_rehearsals SET rehearsal_date=@rehearsal_date, start_time=@start_time,
        end_time=@end_time, venue=@venue, notes=@notes WHERE id=@id
    `).run(params)
    return db().prepare('SELECT * FROM event_rehearsals WHERE id = ?').get(id)
  })

  ipcMain.handle('event_rehearsals:delete', (_e, id: number) => {
    db().prepare('DELETE FROM event_rehearsals WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── ETKİNLİK YAPILACAKLAR ────────────────────────────────────────────────

  ipcMain.handle('event_checklist:getByEvent', (_e, eventId: number) => {
    return db().prepare(`
      SELECT * FROM event_checklist WHERE event_id = ? ORDER BY created_at
    `).all(eventId)
  })

  ipcMain.handle('event_checklist:create', (_e, data: Record<string, unknown>) => {
    const params = { due_date: null, assigned_to: null, ...data }
    const result = db().prepare(`
      INSERT INTO event_checklist (event_id, title, due_date, assigned_to)
      VALUES (@event_id, @title, @due_date, @assigned_to)
    `).run(params)
    return db().prepare('SELECT * FROM event_checklist WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('event_checklist:toggle', (_e, id: number) => {
    db().prepare('UPDATE event_checklist SET is_done = CASE WHEN is_done=1 THEN 0 ELSE 1 END WHERE id = ?').run(id)
    return db().prepare('SELECT * FROM event_checklist WHERE id = ?').get(id)
  })

  ipcMain.handle('event_checklist:delete', (_e, id: number) => {
    db().prepare('DELETE FROM event_checklist WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── ETKİNLİK FOTOĞRAFLARI ────────────────────────────────────────────────

  ipcMain.handle('event_photos:getByEvent', (_e, eventId: number) => {
    return db().prepare('SELECT * FROM event_photos WHERE event_id = ? ORDER BY uploaded_at DESC').all(eventId)
  })

  ipcMain.handle('event_photos:upload', async (_e, eventId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Fotoğraf Seç',
      filters: [{ name: 'Görseller', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || !result.filePaths.length) return []
    const destDir = path.join(app.getPath('userData'), 'event_photos', String(eventId))
    fs.mkdirSync(destDir, { recursive: true })
    const inserted: unknown[] = []
    for (const srcPath of result.filePaths) {
      const name = path.basename(srcPath)
      const destFile = path.join(destDir, `photo_${Date.now()}_${name}`)
      fs.copyFileSync(srcPath, destFile)
      const r = db().prepare(`
        INSERT INTO event_photos (event_id, file_path, file_name)
        VALUES (?, ?, ?)
      `).run(eventId, destFile, name)
      inserted.push(db().prepare('SELECT * FROM event_photos WHERE id = ?').get(r.lastInsertRowid))
    }
    return inserted
  })

  ipcMain.handle('event_photos:delete', (_e, id: number) => {
    const photo = db().prepare('SELECT file_path FROM event_photos WHERE id = ?').get(id) as { file_path: string } | undefined
    if (photo?.file_path) {
      try { fs.unlinkSync(photo.file_path) } catch { /* ignore */ }
    }
    db().prepare('DELETE FROM event_photos WHERE id = ?').run(id)
    return { success: true }
  })
}
