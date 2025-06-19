const pgClient = require('../../config/postgres');

async function runMigrations() {
  try {
    // Usuários registrados
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS registered_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      CREATE INDEX IF NOT EXISTS idx_registered_users_email ON registered_users(email);
      CREATE INDEX IF NOT EXISTS idx_registered_users_username ON registered_users(username);
    `);

    // Salas públicas
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS public_rooms (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES registered_users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        max_users INTEGER DEFAULT 100
      );
      CREATE INDEX IF NOT EXISTS idx_public_rooms_room_id ON public_rooms(room_id);
      CREATE INDEX IF NOT EXISTS idx_public_rooms_created_by ON public_rooms(created_by);
    `);

    // Membros das salas
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(100) REFERENCES public_rooms(room_id),
        username VARCHAR(100) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_online BOOLEAN DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
      CREATE INDEX IF NOT EXISTS idx_room_members_username ON room_members(username);
    `);

    // Sala pública especial "match"
    const matchRoomId = 'match';
    const matchRoom = await pgClient.query('SELECT * FROM public_rooms WHERE room_id = $1', [matchRoomId]);
    if (matchRoom.rows.length === 0) {
      await pgClient.query(`
        INSERT INTO public_rooms (room_id, name, description, created_by, is_active, max_users)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [matchRoomId, 'Match', 'Sala pública especial para matchmaking', null, true, 1000]);
    }

    console.log('[MIGRATION] Migrations do PostgreSQL executadas com sucesso!');
  } catch (error) {
    console.error('[MIGRATION] Erro ao executar migrations:', error);
    throw error;
  }
}

module.exports = runMigrations; 