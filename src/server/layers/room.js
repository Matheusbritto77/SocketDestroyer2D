const pgClient = require('../../config/postgres');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.initializeTables();
  }

  async initializeTables() {
    try {
      // Tabela de usuários registrados
      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS registered_users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          username VARCHAR(100) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE
        )
      `);

      // Tabela de salas públicas
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
        )
      `);

      // Tabela de membros das salas
      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS room_members (
          id SERIAL PRIMARY KEY,
          room_id VARCHAR(100) REFERENCES public_rooms(room_id),
          username VARCHAR(100) NOT NULL,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_online BOOLEAN DEFAULT FALSE
        )
      `);

      console.log('[ROOM] Tabelas inicializadas com sucesso');
    } catch (error) {
      console.error('[ROOM] Erro ao inicializar tabelas:', error);
    }
  }

  // Registra um novo usuário
  async registerUser(email, password, username) {
    try {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      const result = await pgClient.query(`
        INSERT INTO registered_users (email, password_hash, username)
        VALUES ($1, $2, $3)
        RETURNING id, email, username
      `, [email, passwordHash, username]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email ou username já está em uso');
      }
      throw error;
    }
  }

  // Autentica um usuário registrado
  async authenticateUser(email, password) {
    try {
      const bcrypt = require('bcryptjs');
      
      const result = await pgClient.query(`
        SELECT id, email, username, password_hash
        FROM registered_users
        WHERE email = $1 AND is_active = TRUE
      `, [email]);

      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        throw new Error('Senha incorreta');
      }

      // Atualiza último login
      await pgClient.query(`
        UPDATE registered_users
        SET last_login = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [user.id]);

      return { id: user.id, email: user.email, username: user.username };
    } catch (error) {
      throw error;
    }
  }

  // Cria uma nova sala pública
  async createPublicRoom(name, description, createdByUserId) {
    try {
      const roomId = `room_${uuidv4().replace(/-/g, '')}`;
      
      const result = await pgClient.query(`
        INSERT INTO public_rooms (room_id, name, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [roomId, name, description, createdByUserId]);

      const room = result.rows[0];
      
      // Adiciona ao cache
      cache.setRoom(roomId, {
        id: room.id,
        roomId: room.room_id,
        name: room.name,
        description: room.description,
        createdBy: room.created_by,
        createdAt: room.created_at,
        maxUsers: room.max_users,
        currentUsers: 0
      });

      return room;
    } catch (error) {
      throw error;
    }
  }

  // Lista todas as salas públicas
  async getPublicRooms() {
    try {
      const result = await pgClient.query(`
        SELECT pr.*, COUNT(rm.username) as current_users
        FROM public_rooms pr
        LEFT JOIN room_members rm ON pr.room_id = rm.room_id AND rm.is_online = TRUE
        WHERE pr.is_active = TRUE
        GROUP BY pr.id
        ORDER BY pr.created_at DESC
      `);

      return result.rows;
    } catch (error) {
      console.error('[ROOM] Erro ao buscar salas públicas:', error);
      return [];
    }
  }

  // Adiciona usuário à sala
  async addUserToRoom(roomId, username) {
    try {
      // Verifica se a sala existe
      const roomResult = await pgClient.query(`
        SELECT * FROM public_rooms WHERE room_id = $1 AND is_active = TRUE
      `, [roomId]);

      if (roomResult.rows.length === 0) {
        throw new Error('Sala não encontrada');
      }

      const room = roomResult.rows[0];

      // Verifica se o usuário já está na sala
      const existingMember = await pgClient.query(`
        SELECT * FROM room_members WHERE room_id = $1 AND username = $2
      `, [roomId, username]);

      if (existingMember.rows.length > 0) {
        // Atualiza status online
        await pgClient.query(`
          UPDATE room_members
          SET is_online = TRUE
          WHERE room_id = $1 AND username = $2
        `, [roomId, username]);
      } else {
        // Adiciona novo membro
        await pgClient.query(`
          INSERT INTO room_members (room_id, username, is_online)
          VALUES ($1, $2, TRUE)
        `, [roomId, username]);
      }

      // Atualiza cache
      const roomData = cache.getRoom(roomId);
      if (roomData) {
        roomData.currentUsers++;
        cache.setRoom(roomId, roomData);
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Remove usuário da sala
  async removeUserFromRoom(roomId, username) {
    try {
      await pgClient.query(`
        UPDATE room_members
        SET is_online = FALSE
        WHERE room_id = $1 AND username = $2
      `, [roomId, username]);

      // Atualiza cache
      const roomData = cache.getRoom(roomId);
      if (roomData && roomData.currentUsers > 0) {
        roomData.currentUsers--;
        cache.setRoom(roomId, roomData);
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Lista usuários em uma sala
  async getRoomUsers(roomId) {
    try {
      const result = await pgClient.query(`
        SELECT username, joined_at, is_online
        FROM room_members
        WHERE room_id = $1 AND is_online = TRUE
        ORDER BY joined_at ASC
      `, [roomId]);

      return result.rows;
    } catch (error) {
      console.error('[ROOM] Erro ao buscar usuários da sala:', error);
      return [];
    }
  }

  // Verifica se usuário pode criar salas
  async canCreateRoom(userId) {
    try {
      const result = await pgClient.query(`
        SELECT id FROM registered_users WHERE id = $1 AND is_active = TRUE
      `, [userId]);

      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Busca sala por ID
  async getRoomById(roomId) {
    try {
      // Tenta cache primeiro
      const cachedRoom = cache.getRoom(roomId);
      if (cachedRoom) {
        return cachedRoom;
      }

      const result = await pgClient.query(`
        SELECT pr.*, COUNT(rm.username) as current_users
        FROM public_rooms pr
        LEFT JOIN room_members rm ON pr.room_id = rm.room_id AND rm.is_online = TRUE
        WHERE pr.room_id = $1 AND pr.is_active = TRUE
        GROUP BY pr.id
      `, [roomId]);

      if (result.rows.length === 0) {
        return null;
      }

      const room = result.rows[0];
      const roomData = {
        id: room.id,
        roomId: room.room_id,
        name: room.name,
        description: room.description,
        createdBy: room.created_by,
        createdAt: room.created_at,
        maxUsers: room.max_users,
        currentUsers: parseInt(room.current_users) || 0
      };

      // Adiciona ao cache
      cache.setRoom(roomId, roomData);

      return roomData;
    } catch (error) {
      console.error('[ROOM] Erro ao buscar sala:', error);
      return null;
    }
  }

  // Estatísticas das salas
  async getRoomStats() {
    try {
      const result = await pgClient.query(`
        SELECT 
          COUNT(*) as total_rooms,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_rooms,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as total_active_rooms
        FROM public_rooms
      `);

      return result.rows[0];
    } catch (error) {
      console.error('[ROOM] Erro ao buscar estatísticas:', error);
      return { total_rooms: 0, active_rooms: 0, total_active_rooms: 0 };
    }
  }
}

module.exports = new RoomManager(); 