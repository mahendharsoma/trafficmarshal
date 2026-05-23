import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

let pool = null;
let initialized = false;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.MYSQL_URL,
      connectionLimit: 15,
      waitForConnections: true,
      multipleStatements: false,
    });
  }
  return pool;
}

async function ensureSchema() {
  if (initialized) return;
  const p = getPool();
  const ddl = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password VARCHAR(128) NOT NULL,
      name VARCHAR(128) NOT NULL,
      role ENUM('super_admin','dcp','sho','marshal','volunteer') NOT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      zone VARCHAR(64) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS marshals (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(128) NOT NULL,
      role ENUM('marshal','volunteer') NOT NULL,
      zone VARCHAR(64) DEFAULT NULL,
      status ENUM('online','offline','active') NOT NULL DEFAULT 'offline',
      lat DECIMAL(10,7) NOT NULL,
      lng DECIMAL(11,7) NOT NULL,
      points INT NOT NULL DEFAULT 0,
      last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_marshals_status (status),
      INDEX idx_marshals_latlng (lat, lng)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS incidents (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      reported_by VARCHAR(36) DEFAULT NULL,
      ps_id VARCHAR(36) DEFAULT NULL,
      area_name VARCHAR(128) DEFAULT NULL,
      lat DECIMAL(10,7) NOT NULL,
      lng DECIMAL(11,7) NOT NULL,
      address VARCHAR(255) DEFAULT NULL,
      severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      photo_url LONGTEXT DEFAULT NULL,
      status ENUM('open','dispatched','cleared') NOT NULL DEFAULT 'open',
      level TINYINT NOT NULL DEFAULT 1,
      estimated_delay_min INT DEFAULT NULL,
      queue_length_m INT DEFAULT NULL,
      cleared_by VARCHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cleared_at DATETIME DEFAULT NULL,
      INDEX idx_incidents_status (status),
      INDEX idx_incidents_ps (ps_id),
      INDEX idx_incidents_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      incident_id VARCHAR(36) NOT NULL,
      marshal_id VARCHAR(36) NOT NULL,
      marshal_name VARCHAR(128) DEFAULT NULL,
      level TINYINT NOT NULL,
      distance_km DECIMAL(6,2) NOT NULL,
      status ENUM('pending','accepted','cleared','expired') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted_at DATETIME DEFAULT NULL,
      cleared_at DATETIME DEFAULT NULL,
      UNIQUE KEY uniq_incident_marshal (incident_id, marshal_id),
      INDEX idx_alerts_marshal (marshal_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      marshal_id VARCHAR(36) NOT NULL,
      action VARCHAR(32) NOT NULL,
      incident_id VARCHAR(36) DEFAULT NULL,
      points INT DEFAULT NULL,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_activitylog_marshal (marshal_id),
      INDEX idx_activitylog_ts (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS activities (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      marshal_id VARCHAR(36) NOT NULL,
      marshal_name VARCHAR(128) DEFAULT NULL,
      lat DECIMAL(10,7) DEFAULT NULL,
      lng DECIMAL(11,7) DEFAULT NULL,
      address VARCHAR(255) DEFAULT NULL,
      severity ENUM('low','medium','high','critical') DEFAULT 'medium',
      description TEXT DEFAULT NULL,
      photo_url LONGTEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_activities_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS dcp_sho_mappings (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      dcp_id VARCHAR(36) NOT NULL,
      sho_id VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_dcp_sho (dcp_id, sho_id),
      INDEX idx_dcpshomap_dcp (dcp_id),
      INDEX idx_dcpshomap_sho (sho_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS senior_families (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      family_code VARCHAR(20) NOT NULL UNIQUE,
      senior_name VARCHAR(128) NOT NULL,
      age INT DEFAULT NULL,
      gender ENUM('male','female','other') DEFAULT NULL,
      mobile VARCHAR(20) DEFAULT NULL,
      alt_contact VARCHAR(20) DEFAULT NULL,
      address VARCHAR(255) DEFAULT NULL,
      landmark VARCHAR(128) DEFAULT NULL,
      ps_id VARCHAR(36) DEFAULT NULL,
      dcp_id VARCHAR(36) DEFAULT NULL,
      zone VARCHAR(64) DEFAULT NULL,
      emergency_contact_name VARCHAR(128) DEFAULT NULL,
      emergency_contact_phone VARCHAR(20) DEFAULT NULL,
      medical_conditions TEXT DEFAULT NULL,
      doctor_name VARCHAR(128) DEFAULT NULL,
      hospital_name VARCHAR(128) DEFAULT NULL,
      medication_notes TEXT DEFAULT NULL,
      lat DECIMAL(10,7) DEFAULT NULL,
      lng DECIMAL(11,7) DEFAULT NULL,
      risk_category ENUM('low','medium','high','emergency') NOT NULL DEFAULT 'low',
      created_by VARCHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_families_ps (ps_id),
      INDEX idx_families_dcp (dcp_id),
      INDEX idx_families_risk (risk_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS family_assignments (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      family_id VARCHAR(36) NOT NULL,
      marshal_id VARCHAR(36) NOT NULL,
      visit_frequency ENUM('daily','weekly','monthly','emergency') NOT NULL DEFAULT 'weekly',
      status ENUM('pending','in_progress','completed','escalated') NOT NULL DEFAULT 'pending',
      instructions TEXT DEFAULT NULL,
      assigned_by VARCHAR(36) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_assignments_marshal (marshal_id),
      INDEX idx_assignments_family (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS visit_logs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      assignment_id VARCHAR(36) DEFAULT NULL,
      family_id VARCHAR(36) NOT NULL,
      marshal_id VARCHAR(36) NOT NULL,
      marshal_name VARCHAR(128) DEFAULT NULL,
      family_name VARCHAR(128) DEFAULT NULL,
      lat DECIMAL(10,7) DEFAULT NULL,
      lng DECIMAL(11,7) DEFAULT NULL,
      address VARCHAR(255) DEFAULT NULL,
      selfie_photo LONGTEXT DEFAULT NULL,
      visit_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      visit_end DATETIME DEFAULT NULL,
      family_condition ENUM('safe','medical','emergency','police_followup') NOT NULL DEFAULT 'safe',
      notes TEXT DEFAULT NULL,
      signature LONGTEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_visits_family (family_id),
      INDEX idx_visits_marshal (marshal_id),
      INDEX idx_visits_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS escalations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      visit_id VARCHAR(36) DEFAULT NULL,
      family_id VARCHAR(36) DEFAULT NULL,
      raised_by VARCHAR(36) DEFAULT NULL,
      priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      reason TEXT DEFAULT NULL,
      status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
      ack_by VARCHAR(36) DEFAULT NULL,
      ack_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_escalations_status (status),
      INDEX idx_escalations_priority (priority)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS zones (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(128) NOT NULL UNIQUE,
      description VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS traffic_ps (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      zone_id VARCHAR(36) NOT NULL,
      polygon LONGTEXT DEFAULT NULL,
      lat DECIMAL(10,7) DEFAULT NULL,
      lng DECIMAL(11,7) DEFAULT NULL,
      address VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tps_zone (zone_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS dcp_zones (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      dcp_id VARCHAR(36) NOT NULL,
      zone_id VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_dcp_zone (dcp_id, zone_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      actor_id VARCHAR(36) DEFAULT NULL,
      actor_name VARCHAR(128) DEFAULT NULL,
      actor_role VARCHAR(32) DEFAULT NULL,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(32) DEFAULT NULL,
      target_id VARCHAR(36) DEFAULT NULL,
      details TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_actor (actor_id),
      INDEX idx_audit_action (action),
      INDEX idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS incident_reports (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      incident_id VARCHAR(36) NOT NULL,
      marshal_id VARCHAR(36) NOT NULL,
      sho_id VARCHAR(36) DEFAULT NULL,
      summary TEXT DEFAULT NULL,
      final_severity ENUM('low','medium','high','critical') DEFAULT NULL,
      cleared_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reports_incident (incident_id),
      INDEX idx_reports_sho (sho_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];
  for (const sql of ddl) await p.query(sql);
  // Ensure user.role supports 'dcp' & extra columns
  try { await p.query("ALTER TABLE users MODIFY role ENUM('super_admin','dcp','sho','marshal','volunteer') NOT NULL"); } catch {}
  try { await p.query("ALTER TABLE users ADD COLUMN zone_id VARCHAR(36) DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE users ADD COLUMN tps_id VARCHAR(36) DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE marshals ADD COLUMN tps_id VARCHAR(36) DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE incidents ADD COLUMN ps_id VARCHAR(36) DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE incidents ADD COLUMN area_name VARCHAR(128) DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE incidents ADD COLUMN estimated_delay_min INT DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE incidents ADD COLUMN queue_length_m INT DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE incidents ADD COLUMN tps_id VARCHAR(36) DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE incidents ADD COLUMN zone_id VARCHAR(36) DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE senior_families ADD COLUMN tps_id VARCHAR(36) DEFAULT NULL"); } catch {}
  // Alert lifecycle states + timestamps
  try { await p.query("ALTER TABLE alerts MODIFY status ENUM('pending','accepted','reached','under_control','cleared','expired') NOT NULL DEFAULT 'pending'"); } catch {}
  try { await p.query("ALTER TABLE alerts ADD COLUMN reached_at DATETIME DEFAULT NULL"); } catch {}
  try { await p.query("ALTER TABLE alerts ADD COLUMN controlled_at DATETIME DEFAULT NULL"); } catch {}
  await migrateDefaults();
  initialized = true;
}

// Lightweight audit logger
async function audit(actor, action, targetType, targetId, details) {
  try {
    const p = getPool();
    await p.query('INSERT INTO audit_logs (id,actor_id,actor_name,actor_role,action,target_type,target_id,details) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), actor?.id || null, actor?.name || null, actor?.role || null, action, targetType || null, targetId || null,
       details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null]);
  } catch (e) { /* don't break flow */ }
}

// Auto-create default zones/TPS + backfill existing users/marshals
async function migrateDefaults() {
  const p = getPool();
  const defaults = [
    { name: 'Begumpet', lat: 17.4399, lng: 78.4738, polygon: [[17.434,78.464],[17.446,78.464],[17.446,78.484],[17.434,78.484]] },
    { name: 'Alwal',    lat: 17.4978, lng: 78.5036, polygon: [[17.491,78.494],[17.504,78.494],[17.504,78.514],[17.491,78.514]] },
    { name: 'Thirumalgiri', lat: 17.4858, lng: 78.5132, polygon: [[17.479,78.504],[17.492,78.504],[17.492,78.523],[17.479,78.523]] },
    { name: 'Uppal',    lat: 17.4053, lng: 78.5594, polygon: [[17.399,78.550],[17.412,78.550],[17.412,78.569],[17.399,78.569]] },
  ];
  for (const z of defaults) {
    // zone
    let [[zr]] = await p.query('SELECT id FROM zones WHERE name=?', [z.name]);
    if (!zr) {
      const zid = uuidv4();
      await p.query('INSERT INTO zones (id,name,description) VALUES (?,?,?)', [zid, z.name, `${z.name} jurisdiction`]);
      zr = { id: zid };
    }
    // tps
    const [[tr]] = await p.query('SELECT id FROM traffic_ps WHERE zone_id=? AND name=?', [zr.id, `${z.name} Traffic PS`]);
    let tpsId = tr?.id;
    if (!tpsId) {
      tpsId = uuidv4();
      await p.query('INSERT INTO traffic_ps (id,name,zone_id,polygon,lat,lng,address) VALUES (?,?,?,?,?,?,?)',
        [tpsId, `${z.name} Traffic PS`, zr.id, JSON.stringify(z.polygon), z.lat, z.lng, `${z.name}, Hyderabad`]);
    }
    // backfill users where zone string matches and zone_id NULL
    await p.query("UPDATE users SET zone_id=?, tps_id=? WHERE zone=? AND zone_id IS NULL AND role IN ('sho','marshal')", [zr.id, tpsId, z.name]);
    await p.query("UPDATE users SET zone_id=? WHERE zone=? AND zone_id IS NULL AND role='volunteer'", [zr.id, z.name]);
    await p.query("UPDATE marshals SET tps_id=? WHERE zone=? AND tps_id IS NULL AND role='marshal'", [tpsId, z.name]);
    await p.query("UPDATE senior_families SET tps_id=? WHERE zone=? AND tps_id IS NULL", [tpsId, z.name]);
  }
  // DCPs get all zones by default
  const [dcps] = await p.query("SELECT id FROM users WHERE role='dcp'");
  const [zones] = await p.query('SELECT id FROM zones');
  for (const d of dcps) {
    for (const z of zones) {
      try { await p.query('INSERT INTO dcp_zones (id,dcp_id,zone_id) VALUES (?,?,?)', [uuidv4(), d.id, z.id]); } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
    }
  }
}

const ok = (data, status = 200) => NextResponse.json(data, { status });
const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

// ----- ROW MAPPERS -----
const marshalRow = (r) => ({
  id: r.id, userId: r.user_id, name: r.name, role: r.role, zone: r.zone,
  tpsId: r.tps_id || null,
  status: r.status, points: r.points,
  currentLocation: { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] },
  lastUpdated: r.last_updated,
});
const incidentRow = (r) => ({
  id: r.id, reportedBy: r.reported_by, psId: r.ps_id, areaName: r.area_name,
  location: { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] },
  address: r.address, severity: r.severity, photoUrl: r.photo_url,
  status: r.status, level: r.level,
  estimatedDelayMin: r.estimated_delay_min, queueLengthM: r.queue_length_m,
  clearedBy: r.cleared_by, createdAt: r.created_at, clearedAt: r.cleared_at,
});
const activityRow = (r) => ({
  id: r.id, marshalId: r.marshal_id, marshalName: r.marshal_name,
  location: (r.lat != null && r.lng != null) ? { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] } : null,
  address: r.address, severity: r.severity, description: r.description,
  photoUrl: r.photo_url, createdAt: r.created_at,
});
const alertRow = (r) => ({
  id: r.id, incidentId: r.incident_id, marshalId: r.marshal_id,
  marshalName: r.marshal_name, level: r.level, distanceKm: Number(r.distance_km),
  status: r.status, createdAt: r.created_at, acceptedAt: r.accepted_at, clearedAt: r.cleared_at,
});
const familyRow = (r) => ({
  id: r.id, familyCode: r.family_code, seniorName: r.senior_name, age: r.age,
  gender: r.gender, mobile: r.mobile, altContact: r.alt_contact,
  address: r.address, landmark: r.landmark, psId: r.ps_id, tpsId: r.tps_id || r.ps_id, dcpId: r.dcp_id, zone: r.zone,
  emergencyContactName: r.emergency_contact_name, emergencyContactPhone: r.emergency_contact_phone,
  medicalConditions: r.medical_conditions, doctorName: r.doctor_name,
  hospitalName: r.hospital_name, medicationNotes: r.medication_notes,
  lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
  riskCategory: r.risk_category, createdBy: r.created_by, createdAt: r.created_at,
});
const assignmentRow = (r) => ({
  id: r.id, familyId: r.family_id, marshalId: r.marshal_id,
  visitFrequency: r.visit_frequency, status: r.status, instructions: r.instructions,
  assignedBy: r.assigned_by, createdAt: r.created_at,
});
const visitRow = (r) => ({
  id: r.id, assignmentId: r.assignment_id, familyId: r.family_id, marshalId: r.marshal_id,
  marshalName: r.marshal_name, familyName: r.family_name,
  lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
  address: r.address, selfiePhoto: r.selfie_photo, visitStart: r.visit_start, visitEnd: r.visit_end,
  familyCondition: r.family_condition, notes: r.notes, signature: r.signature, createdAt: r.created_at,
});
const escalationRow = (r) => ({
  id: r.id, visitId: r.visit_id, familyId: r.family_id, raisedBy: r.raised_by,
  priority: r.priority, reason: r.reason, status: r.status,
  ackBy: r.ack_by, ackAt: r.ack_at, createdAt: r.created_at,
});

// ----- SEED -----
async function seedDb() {
  const p = getPool();
  const [[{ c }]] = await p.query('SELECT COUNT(*) AS c FROM users');
  if (c > 0) {
    // Add DCP/families if missing (for upgrade path)
    const [[{ dc }]] = await p.query("SELECT COUNT(*) AS dc FROM users WHERE role='dcp'");
    if (dc === 0) await seedDcpAndFamilies();
    return { seeded: false, msg: 'Base users exist; DCP+families ensured' };
  }

  const zones = [
    { name: 'Begumpet', center: [78.4738, 17.4399] },
    { name: 'Alwal', center: [78.5036, 17.4978] },
    { name: 'Thirumalgiri', center: [78.5132, 17.4858] },
    { name: 'Uppal', center: [78.5594, 17.4053] },
  ];

  // Base accounts
  const rkscId = uuidv4();
  const sho1Id = uuidv4();
  const sho2Id = uuidv4();
  await p.query('INSERT INTO users (id,username,password,name,role,phone,zone) VALUES ?', [[
    [rkscId, 'rksc', 'rksc123', 'RKSC Super Admin', 'super_admin', '9999999999', 'All'],
    [sho1Id, 'sho1', 'sho123', 'SHO Begumpet PS', 'sho', '9000000001', 'Begumpet'],
    [sho2Id, 'sho2', 'sho123', 'SHO Alwal PS', 'sho', '9000000002', 'Alwal'],
  ]]);

  // Marshals & Volunteers
  let m = 1, v = 1;
  for (const z of zones) {
    for (let i = 0; i < 3; i++) {
      const id = uuidv4();
      const lng = z.center[0] + (Math.random() - 0.5) * 0.02;
      const lat = z.center[1] + (Math.random() - 0.5) * 0.02;
      const status = i === 0 ? 'active' : i === 1 ? 'online' : 'offline';
      const name = `Marshal ${m} (${z.name})`;
      await p.query('INSERT INTO users (id,username,password,name,role,phone,zone) VALUES (?,?,?,?,?,?,?)',
        [id, `marshal${m}`, 'marshal123', name, 'marshal', `90100000${String(m).padStart(2, '0')}`, z.name]);
      await p.query('INSERT INTO marshals (id,user_id,name,role,zone,status,lat,lng,points) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, id, name, 'marshal', z.name, status, lat, lng, Math.floor(Math.random() * 200)]);
      m++;
    }
    for (let i = 0; i < 2; i++) {
      const id = uuidv4();
      const lng = z.center[0] + (Math.random() - 0.5) * 0.025;
      const lat = z.center[1] + (Math.random() - 0.5) * 0.025;
      const status = i === 0 ? 'online' : 'offline';
      const name = `Volunteer ${v} (${z.name})`;
      await p.query('INSERT INTO users (id,username,password,name,role,phone,zone) VALUES (?,?,?,?,?,?,?)',
        [id, `volunteer${v}`, 'volunteer123', name, 'volunteer', `90200000${String(v).padStart(2, '0')}`, z.name]);
      await p.query('INSERT INTO marshals (id,user_id,name,role,zone,status,lat,lng,points) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, id, name, 'volunteer', z.name, status, lat, lng, Math.floor(Math.random() * 100)]);
      v++;
    }
  }
  await seedDcpAndFamilies();
  const [[{ uc }]] = await p.query('SELECT COUNT(*) AS uc FROM users');
  const [[{ mc }]] = await p.query('SELECT COUNT(*) AS mc FROM marshals');
  const [[{ fc }]] = await p.query('SELECT COUNT(*) AS fc FROM senior_families');
  return { seeded: true, users: uc, marshals: mc, families: fc };
}

async function seedDcpAndFamilies() {
  const p = getPool();
  // Create DCP user
  const dcpId = uuidv4();
  await p.query('INSERT IGNORE INTO users (id,username,password,name,role,phone,zone) VALUES (?,?,?,?,?,?,?)',
    [dcpId, 'dcp1', 'dcp123', 'DCP Malkajgiri', 'dcp', '9000099999', 'All']);
  // Get SHO ids
  const [shos] = await p.query("SELECT id FROM users WHERE role='sho'");
  // Map DCP to all SHOs
  for (const s of shos) {
    await p.query('INSERT IGNORE INTO dcp_sho_mappings (id,dcp_id,sho_id) VALUES (?,?,?)', [uuidv4(), dcpId, s.id]);
  }
  // Get SHO map by zone
  const [shoMap] = await p.query("SELECT id, zone FROM users WHERE role='sho'");
  const shoByZone = Object.fromEntries(shoMap.map(s => [s.zone, s.id]));

  // Seed senior families
  const familySeeds = [
    { name: 'Lakshmi Devi', age: 78, gender: 'female', zone: 'Begumpet', risk: 'medium', medical: 'Diabetes, Hypertension', center: [78.4738, 17.4399] },
    { name: 'Ramesh Kumar', age: 82, gender: 'male', zone: 'Begumpet', risk: 'high', medical: 'Heart condition', center: [78.4750, 17.4410] },
    { name: 'Saraswati Bai', age: 75, gender: 'female', zone: 'Alwal', risk: 'low', medical: 'Arthritis', center: [78.5036, 17.4978] },
    { name: 'Venkatesh Rao', age: 80, gender: 'male', zone: 'Alwal', risk: 'emergency', medical: 'Recent stroke recovery', center: [78.5050, 17.4990] },
    { name: 'Padma Reddy', age: 72, gender: 'female', zone: 'Thirumalgiri', risk: 'medium', medical: 'Diabetes', center: [78.5132, 17.4858] },
    { name: 'Krishna Murthy', age: 85, gender: 'male', zone: 'Thirumalgiri', risk: 'high', medical: 'Vision impairment, BP', center: [78.5140, 17.4865] },
    { name: 'Anjali Devi', age: 70, gender: 'female', zone: 'Uppal', risk: 'low', medical: 'None significant', center: [78.5594, 17.4053] },
    { name: 'Subba Rao', age: 79, gender: 'male', zone: 'Uppal', risk: 'medium', medical: 'Kidney issues', center: [78.5600, 17.4060] },
  ];
  let idx = 1;
  for (const f of familySeeds) {
    const lng = f.center[0] + (Math.random() - 0.5) * 0.01;
    const lat = f.center[1] + (Math.random() - 0.5) * 0.01;
    const psId = shoByZone[f.zone] || shoByZone['Begumpet'];
    await p.query(
      `INSERT IGNORE INTO senior_families
       (id, family_code, senior_name, age, gender, mobile, address, landmark, ps_id, dcp_id, zone,
        emergency_contact_name, emergency_contact_phone, medical_conditions, doctor_name, hospital_name,
        lat, lng, risk_category, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuidv4(), `FAM-${String(idx).padStart(4, '0')}`, f.name, f.age, f.gender,
        `94400000${String(idx).padStart(2, '0')}`, `${f.zone} Main Road, House #${100 + idx}`,
        `Near ${f.zone} Park`, psId, dcpId, f.zone,
        'Son: ' + f.name.split(' ')[0] + ' Jr', `94500000${String(idx).padStart(2, '0')}`,
        f.medical, 'Dr. Reddy', f.zone + ' Govt Hospital', lat, lng, f.risk, dcpId]
    );
    idx++;
  }

  // Auto-create some assignments
  const [marshalsInDB] = await p.query("SELECT id, zone FROM marshals WHERE role='marshal' AND status != 'offline'");
  const [families] = await p.query("SELECT id, zone FROM senior_families");
  const marshalByZone = {};
  marshalsInDB.forEach(m => { if (!marshalByZone[m.zone]) marshalByZone[m.zone] = []; marshalByZone[m.zone].push(m.id); });
  for (const f of families) {
    const list = marshalByZone[f.zone];
    if (list && list.length) {
      const marshalId = list[Math.floor(Math.random() * list.length)];
      await p.query(
        'INSERT IGNORE INTO family_assignments (id,family_id,marshal_id,visit_frequency,assigned_by,instructions) VALUES (?,?,?,?,?,?)',
        [uuidv4(), f.id, marshalId, 'weekly', dcpId, 'Standard welfare check.']
      );
    }
  }
}

// ----- DISPATCH (proximity) -----
async function dispatchIncident(incidentId, level) {
  const p = getPool();
  const [[inc]] = await p.query('SELECT * FROM incidents WHERE id=?', [incidentId]);
  if (!inc) return { dispatched: 0 };
  const radiusMeters = level === 1 ? 1000 : level === 2 ? 3000 : 5000;
  const scopeClauses = [];
  const scopeArgs = [];
  if (inc.tps_id) { scopeClauses.push('tps_id=?'); scopeArgs.push(inc.tps_id); }
  const scopeWhere = scopeClauses.length ? `AND (${scopeClauses.join(' OR ')})` : '';
  const [rows] = await p.query(
    `SELECT id, name, lat, lng, status, role,
            ST_Distance_Sphere(POINT(lng, lat), POINT(?, ?)) AS dist_m
     FROM marshals
     WHERE status IN ('online','active') ${scopeWhere}
     HAVING dist_m <= ?
     ORDER BY dist_m ASC LIMIT 20`,
    [Number(inc.lng), Number(inc.lat), ...scopeArgs, radiusMeters]
  );
  let dispatched = 0;
  for (const r of rows) {
    const distKm = (r.dist_m / 1000).toFixed(2);
    try {
      await p.query(
        'INSERT INTO alerts (id,incident_id,marshal_id,marshal_name,level,distance_km,status) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), incidentId, r.id, r.name, level, distKm, 'pending']
      );
      dispatched++;
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
  return { dispatched, level, radiusMeters, marshalIds: rows.map(r => r.id) };
}

// ====== MAIN HANDLER ======
async function handle(request) {
  if (!process.env.MYSQL_URL) return err('MYSQL_URL not configured', 500);
  await ensureSchema();
  const p = getPool();
  const { pathname, searchParams } = new URL(request.url);
  const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method;
  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try { body = await request.json(); } catch { body = {}; }
  }

  if (parts.length === 0) return ok({ message: 'MKSC Traffic Marshal API', ok: true });
  if (parts[0] === 'seed' && method === 'POST') return ok(await seedDb());

  // ----- ZONES (now DB-backed) -----
  if (parts[0] === 'zones' && method === 'GET') {
    const [zones] = await p.query('SELECT id, name, description FROM zones ORDER BY name');
    const [tpsRows] = await p.query('SELECT id, name, zone_id, polygon, lat, lng FROM traffic_ps');
    const byZone = {};
    tpsRows.forEach(t => {
      let poly = null;
      try { poly = t.polygon ? JSON.parse(t.polygon) : null; } catch {}
      if (!byZone[t.zone_id]) byZone[t.zone_id] = [];
      byZone[t.zone_id].push({ id: t.id, name: t.name, polygon: poly, lat: t.lat ? Number(t.lat) : null, lng: t.lng ? Number(t.lng) : null });
    });
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
    return ok({
      zones: zones.map((z, i) => ({
        id: z.id, name: z.name, description: z.description,
        color: colors[i % colors.length],
        // legacy: pick first TPS polygon as zone "polygon" for backward-compat
        polygon: byZone[z.id]?.[0]?.polygon || null,
        trafficPS: byZone[z.id] || [],
      })),
    });
  }

  // ----- TRAFFIC POLICE STATIONS -----
  if (parts[0] === 'tps') {
    if (method === 'GET' && parts.length === 1) {
      const zoneId = searchParams.get('zoneId');
      let sql = 'SELECT * FROM traffic_ps';
      const args = [];
      if (zoneId) { sql += ' WHERE zone_id=?'; args.push(zoneId); }
      sql += ' ORDER BY name';
      const [rows] = await p.query(sql, args);
      return ok({
        tps: rows.map(t => ({
          id: t.id, name: t.name, zoneId: t.zone_id, address: t.address,
          lat: t.lat ? Number(t.lat) : null, lng: t.lng ? Number(t.lng) : null,
          polygon: (() => { try { return t.polygon ? JSON.parse(t.polygon) : null; } catch { return null; } })(),
          createdAt: t.created_at,
        }))
      });
    }
  }

  if (parts[0] === 'sho' && parts.length === 3 && parts[2] === 'tps' && method === 'GET') {
    const shoId = parts[1];
    const [[u]] = await p.query('SELECT tps_id, zone_id FROM users WHERE id=? AND role=?', [shoId, 'sho']);
    if (!u?.tps_id) return ok({ tps: null, zones: [] });
    const [[t]] = await p.query(
      `SELECT t.*, z.name AS zone_name FROM traffic_ps t LEFT JOIN zones z ON z.id=t.zone_id WHERE t.id=?`,
      [u.tps_id]
    );
    if (!t) return ok({ tps: null, zones: [] });
    const polygon = (() => { try { return t.polygon ? JSON.parse(t.polygon) : null; } catch { return null; } })();
    return ok({
      tps: {
        id: t.id, name: t.name, zoneId: t.zone_id, zoneName: t.zone_name,
        address: t.address, lat: t.lat ? Number(t.lat) : null, lng: t.lng ? Number(t.lng) : null,
        polygon,
      },
      zones: [{
        id: t.id, name: t.name, zoneName: t.zone_name, polygon, color: '#3b82f6',
      }],
    });
  }

  // ----- ADMIN: ZONES & TPS CRUD -----
  if (parts[0] === 'admin' && parts[1] === 'zones') {
    if (method === 'GET' && parts.length === 2) {
      const [rows] = await p.query('SELECT * FROM zones ORDER BY name');
      return ok({ zones: rows });
    }
    if (method === 'POST' && parts.length === 2) {
      const { name, description } = body;
      if (!name) return err('Name required');
      const id = uuidv4();
      try { await p.query('INSERT INTO zones (id,name,description) VALUES (?,?,?)', [id, name, description || null]); }
      catch (e) { if (e.code === 'ER_DUP_ENTRY') return err('Zone name already exists'); throw e; }
      return ok({ zone: { id, name, description } });
    }
    if (parts.length === 3 && method === 'PATCH') {
      const { name, description } = body;
      await p.query('UPDATE zones SET name=COALESCE(?,name), description=COALESCE(?,description) WHERE id=?', [name || null, description || null, parts[2]]);
      return ok({ ok: true });
    }
    if (parts.length === 3 && method === 'DELETE') {
      await p.query('DELETE FROM zones WHERE id=?', [parts[2]]);
      await p.query('DELETE FROM traffic_ps WHERE zone_id=?', [parts[2]]);
      await p.query('DELETE FROM dcp_zones WHERE zone_id=?', [parts[2]]);
      return ok({ ok: true });
    }
  }

  if (parts[0] === 'admin' && parts[1] === 'tps') {
    if (method === 'GET' && parts.length === 2) {
      const [rows] = await p.query(`SELECT t.*, z.name AS zone_name FROM traffic_ps t LEFT JOIN zones z ON z.id = t.zone_id ORDER BY z.name, t.name`);
      return ok({
        tps: rows.map(t => ({
          id: t.id, name: t.name, zoneId: t.zone_id, zoneName: t.zone_name,
          address: t.address, lat: t.lat ? Number(t.lat) : null, lng: t.lng ? Number(t.lng) : null,
          polygon: (() => { try { return t.polygon ? JSON.parse(t.polygon) : null; } catch { return null; } })(),
          createdAt: t.created_at,
        }))
      });
    }
    if (method === 'POST' && parts.length === 2) {
      const { name, zoneId, polygon, lat, lng, address } = body;
      if (!name || !zoneId) return err('name and zoneId required');
      const id = uuidv4();
      await p.query('INSERT INTO traffic_ps (id,name,zone_id,polygon,lat,lng,address) VALUES (?,?,?,?,?,?,?)',
        [id, name, zoneId, polygon ? JSON.stringify(polygon) : null, lat || null, lng || null, address || null]);
      return ok({ tps: { id, name, zoneId, polygon, lat, lng, address } });
    }
    if (parts.length === 3 && method === 'PATCH') {
      const { name, zoneId, polygon, lat, lng, address } = body;
      const sets = [], vals = [];
      if (name !== undefined) { sets.push('name=?'); vals.push(name); }
      if (zoneId !== undefined) { sets.push('zone_id=?'); vals.push(zoneId); }
      if (polygon !== undefined) { sets.push('polygon=?'); vals.push(polygon ? JSON.stringify(polygon) : null); }
      if (lat !== undefined) { sets.push('lat=?'); vals.push(lat); }
      if (lng !== undefined) { sets.push('lng=?'); vals.push(lng); }
      if (address !== undefined) { sets.push('address=?'); vals.push(address); }
      if (sets.length) { vals.push(parts[2]); await p.query(`UPDATE traffic_ps SET ${sets.join(', ')} WHERE id=?`, vals); }
      return ok({ ok: true });
    }
    if (parts.length === 3 && method === 'DELETE') {
      await p.query('DELETE FROM traffic_ps WHERE id=?', [parts[2]]);
      return ok({ ok: true });
    }
  }

  // ----- DCP <-> ZONES -----
  if (parts[0] === 'dcp' && parts.length === 3 && parts[2] === 'zones' && method === 'GET') {
    const [rows] = await p.query('SELECT z.id, z.name, z.description FROM dcp_zones m JOIN zones z ON z.id=m.zone_id WHERE m.dcp_id=?', [parts[1]]);
    return ok({ zones: rows });
  }
  if (parts[0] === 'dcp' && parts.length === 3 && parts[2] === 'zones' && method === 'POST') {
    const { zoneId } = body;
    try { await p.query('INSERT INTO dcp_zones (id,dcp_id,zone_id) VALUES (?,?,?)', [uuidv4(), parts[1], zoneId]); }
    catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
    return ok({ ok: true });
  }
  if (parts[0] === 'dcp' && parts.length === 4 && parts[2] === 'zones' && method === 'DELETE') {
    await p.query('DELETE FROM dcp_zones WHERE dcp_id=? AND zone_id=?', [parts[1], parts[3]]);
    return ok({ ok: true });
  }

  // ----- NEARBY INCIDENTS (Volunteer scope) -----
  if (parts[0] === 'incidents' && parts[1] === 'nearby' && method === 'GET') {
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseInt(searchParams.get('radius') || '1000');
    if (Number.isNaN(lat) || Number.isNaN(lng)) return err('lat & lng required');
    const [rows] = await p.query(
      `SELECT *, ST_Distance_Sphere(POINT(lng,lat), POINT(?,?)) AS dist_m
       FROM incidents
       WHERE status IN ('open','dispatched')
       HAVING dist_m <= ?
       ORDER BY dist_m ASC LIMIT 20`,
      [lng, lat, radius]
    );
    return ok({ incidents: rows.map(r => ({ ...incidentRow(r), distanceM: Math.round(r.dist_m) })) });
  }

  // ----- AUTH -----
  if (parts[0] === 'auth' && parts[1] === 'login' && method === 'POST') {
    const { username, password } = body;
    const [[u]] = await p.query('SELECT * FROM users WHERE username=? AND password=? LIMIT 1', [username, password]);
    if (!u) return err('Invalid credentials', 401);
    const { password: _, ...safe } = u;
    await audit({ id: u.id, name: u.name, role: u.role }, 'login', 'user', u.id, null);
    return ok({ user: { ...safe, createdAt: u.created_at } });
  }

  // ----- ZONES (legacy hardcoded handler removed; DB-backed handler is above) -----

  // ----- MARSHALS -----
  if (parts[0] === 'marshals') {
    if (method === 'GET' && parts.length === 1) {
      const [rows] = await p.query('SELECT * FROM marshals');
      return ok({ marshals: rows.map(marshalRow) });
    }
    if (parts.length === 2 && method === 'GET') {
      const [[r]] = await p.query('SELECT * FROM marshals WHERE id=?', [parts[1]]);
      if (!r) return err('Not found', 404);
      return ok({ marshal: marshalRow(r) });
    }
    if (parts.length === 3 && parts[2] === 'status' && method === 'PATCH') {
      const { status } = body;
      if (!['online','offline','active'].includes(status)) return err('Invalid status');
      await p.query('UPDATE marshals SET status=?, last_updated=NOW() WHERE id=?', [status, parts[1]]);
      await p.query('INSERT INTO activity_logs (id,marshal_id,action) VALUES (?,?,?)', [uuidv4(), parts[1], status]);
      return ok({ ok: true });
    }
    if (parts.length === 3 && parts[2] === 'location' && method === 'PATCH') {
      const { lat, lng } = body;
      await p.query('UPDATE marshals SET lat=?, lng=?, last_updated=NOW() WHERE id=?', [lat, lng, parts[1]]);
      return ok({ ok: true });
    }
  }

  // ----- INCIDENTS -----
  if (parts[0] === 'incidents') {
    if (method === 'GET' && parts.length === 1) {
      const [rows] = await p.query('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 100');
      return ok({ incidents: rows.map(incidentRow) });
    }
    if (parts.length === 3 && parts[2] === 'nearest-marshals' && method === 'GET') {
      const [[inc]] = await p.query('SELECT * FROM incidents WHERE id=?', [parts[1]]);
      if (!inc) return err('Incident not found', 404);
      const radius = parseInt(searchParams.get('radius') || '5000');
      const scopeClauses = [];
      const scopeArgs = [];
      if (inc.tps_id) { scopeClauses.push('tps_id=?'); scopeArgs.push(inc.tps_id); }
      const scopeWhere = scopeClauses.length ? `AND (${scopeClauses.join(' OR ')})` : '';
      const [rows] = await p.query(
        `SELECT id, name, lat, lng, status, role,
                ST_Distance_Sphere(POINT(lng, lat), POINT(?, ?)) AS dist_m
         FROM marshals
         WHERE status IN ('online','active') ${scopeWhere}
         HAVING dist_m <= ?
         ORDER BY dist_m ASC LIMIT 10`,
        [Number(inc.lng), Number(inc.lat), ...scopeArgs, radius]
      );
      return ok({ marshals: rows.map(r => ({ id: r.id, name: r.name, status: r.status, lat: Number(r.lat), lng: Number(r.lng), distanceKm: Number(r.dist_m / 1000).toFixed(2) })) });
    }
    if (parts.length === 3 && parts[2] === 'assign' && method === 'POST') {
      const { marshalId, level = 1 } = body;
      if (!marshalId) return err('marshalId required');
      const [[inc]] = await p.query('SELECT * FROM incidents WHERE id=?', [parts[1]]);
      if (!inc) return err('Incident not found', 404);
      const [[m]] = await p.query(
        `SELECT id, name, lat, lng, status,
                ST_Distance_Sphere(POINT(lng, lat), POINT(?, ?)) AS dist_m
         FROM marshals WHERE id=? AND status IN ('online','active')`,
        [Number(inc.lng), Number(inc.lat), marshalId]
      );
      if (!m) return err('Marshal not available', 404);
      const distKm = (m.dist_m / 1000).toFixed(2);
      try {
        await p.query(
          'INSERT INTO alerts (id,incident_id,marshal_id,marshal_name,level,distance_km,status) VALUES (?,?,?,?,?,?,?)',
          [uuidv4(), parts[1], m.id, m.name, level, distKm, 'pending']
        );
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }
      await p.query("UPDATE incidents SET status='dispatched', level=? WHERE id=? AND status='open'", [level, parts[1]]);
      return ok({ assigned: { id: m.id, name: m.name, distanceKm: distKm }, alert: true });
    }
    if (parts.length === 3 && parts[2] === 'assist' && method === 'POST') {
      const { volunteerId } = body;
      if (!volunteerId) return err('volunteerId required');
      const [[inc]] = await p.query('SELECT * FROM incidents WHERE id=?', [parts[1]]);
      if (!inc) return err('Incident not found', 404);
      const [[v]] = await p.query(
        `SELECT id, name, lat, lng, status,
                ST_Distance_Sphere(POINT(lng, lat), POINT(?, ?)) AS dist_m
         FROM marshals WHERE id=? AND role='volunteer'`,
        [Number(inc.lng), Number(inc.lat), volunteerId]
      );
      if (!v) return err('Volunteer not found', 404);
      const distKm = (v.dist_m / 1000).toFixed(2);
      try {
        await p.query(
          'INSERT INTO alerts (id,incident_id,marshal_id,marshal_name,level,distance_km,status,accepted_at) VALUES (?,?,?,?,?,?,?,NOW())',
          [uuidv4(), parts[1], v.id, v.name, inc.level || 1, distKm, 'accepted']
        );
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
        await p.query("UPDATE alerts SET status='accepted', accepted_at=COALESCE(accepted_at,NOW()) WHERE incident_id=? AND marshal_id=?", [parts[1], v.id]);
      }
      await p.query("UPDATE incidents SET status='dispatched' WHERE id=? AND status='open'", [parts[1]]);
      await p.query('UPDATE marshals SET status=? WHERE id=?', ['active', v.id]);
      return ok({ assisted: true, distanceKm: distKm });
    }
    if (method === 'POST' && parts.length === 1) {
      const { lat, lng, address, severity, reportedBy, photoUrl, psId, areaName, manualAssign } = body;
      const id = uuidv4();
      const sevMap = { low: 5, medium: 12, high: 25, critical: 45 };
      const queueMap = { low: 100, medium: 300, high: 700, critical: 1500 };
      const delay = sevMap[severity] || 10;
      const queue = queueMap[severity] || 200;
      // resolve TPS/zone from reporter (SHO) if available
      let tpsId = null, zoneId = null;
      if (reportedBy) {
        const [[u]] = await p.query('SELECT tps_id, zone_id FROM users WHERE id=?', [reportedBy]);
        tpsId = u?.tps_id || null;
        zoneId = u?.zone_id || null;
      }
      await p.query(
        `INSERT INTO incidents (id,reported_by,ps_id,area_name,lat,lng,address,severity,photo_url,status,level,estimated_delay_min,queue_length_m,tps_id,zone_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, reportedBy || null, psId || reportedBy || null, areaName || address || 'Unknown',
         lat, lng, address || 'Unknown', severity || 'medium', photoUrl || null, 'open', 1, delay, queue, tpsId, zoneId]
      );
      const [[fresh]] = await p.query('SELECT * FROM incidents WHERE id=?', [id]);
      if (manualAssign) return ok({ incident: incidentRow(fresh), dispatch: { dispatched: 0, manual: true } });
      const result = await dispatchIncident(id, 1);
      return ok({ incident: incidentRow(fresh), dispatch: result });
    }
    if (parts.length === 3 && parts[2] === 'escalate' && method === 'POST') {
      const [[inc]] = await p.query('SELECT * FROM incidents WHERE id=?', [parts[1]]);
      if (!inc) return err('Not found', 404);
      const newLevel = Math.min((inc.level || 1) + 1, 3);
      await p.query('UPDATE incidents SET level=? WHERE id=?', [newLevel, parts[1]]);
      const result = await dispatchIncident(parts[1], newLevel);
      return ok({ level: newLevel, dispatch: result });
    }
    if (parts.length === 3 && parts[2] === 'clear' && method === 'POST') {
      const { marshalId } = body;
      await p.query('UPDATE incidents SET status=?, cleared_at=NOW(), cleared_by=? WHERE id=?', ['cleared', marshalId, parts[1]]);
      const [[inc]] = await p.query('SELECT * FROM incidents WHERE id=?', [parts[1]]);
      const minutes = (Date.now() - new Date(inc.created_at).getTime()) / 60000;
      const points = Math.max(50, Math.floor(150 - minutes * 5));
      await p.query('UPDATE marshals SET points = points + ? WHERE id=?', [points, marshalId]);
      await p.query('INSERT INTO activity_logs (id,marshal_id,action,incident_id,points) VALUES (?,?,?,?,?)',
        [uuidv4(), marshalId, 'incident_clear', parts[1], points]);
      await p.query('UPDATE alerts SET status=?, cleared_at=NOW() WHERE incident_id=?', ['cleared', parts[1]]);
      return ok({ ok: true, points });
    }
  }

  // ----- ALERTS -----
  if (parts[0] === 'alerts') {
    if (method === 'GET' && parts.length === 2 && parts[1].startsWith('marshal-')) {
      const marshalId = parts[1].replace('marshal-', '');
      const [rows] = await p.query(
        "SELECT * FROM alerts WHERE marshal_id=? AND status IN ('pending','accepted','reached','under_control') ORDER BY created_at DESC",
        [marshalId]
      );
      if (!rows.length) return ok({ alerts: [] });
      const incIds = [...new Set(rows.map(r => r.incident_id))];
      const placeholders = incIds.map(() => '?').join(',');
      const [incs] = await p.query(`SELECT * FROM incidents WHERE id IN (${placeholders})`, incIds);
      const incMap = Object.fromEntries(incs.map(i => [i.id, incidentRow(i)]));
      return ok({ alerts: rows.map(r => ({ ...alertRow(r), incident: incMap[r.incident_id] })) });
    }
    if (parts.length === 3 && parts[2] === 'accept' && method === 'POST') {
      await p.query('UPDATE alerts SET status=?, accepted_at=NOW() WHERE id=?', ['accepted', parts[1]]);
      const [[a]] = await p.query('SELECT * FROM alerts WHERE id=?', [parts[1]]);
      if (a) await p.query("UPDATE incidents SET status='dispatched' WHERE id=? AND status='open'", [a.incident_id]);
      await audit({ id: a?.marshal_id, name: a?.marshal_name, role: 'marshal' }, 'alert_accepted', 'alert', parts[1], { incidentId: a?.incident_id });
      return ok({ ok: true });
    }
    if (parts.length === 3 && parts[2] === 'reach' && method === 'POST') {
      await p.query('UPDATE alerts SET status=?, reached_at=NOW() WHERE id=?', ['reached', parts[1]]);
      const [[a]] = await p.query('SELECT * FROM alerts WHERE id=?', [parts[1]]);
      await audit({ id: a?.marshal_id, name: a?.marshal_name, role: 'marshal' }, 'alert_reached', 'alert', parts[1], { incidentId: a?.incident_id });
      return ok({ ok: true });
    }
    if (parts.length === 3 && parts[2] === 'control' && method === 'POST') {
      await p.query('UPDATE alerts SET status=?, controlled_at=NOW() WHERE id=?', ['under_control', parts[1]]);
      const [[a]] = await p.query('SELECT * FROM alerts WHERE id=?', [parts[1]]);
      await audit({ id: a?.marshal_id, name: a?.marshal_name, role: 'marshal' }, 'alert_under_control', 'alert', parts[1], { incidentId: a?.incident_id });
      return ok({ ok: true });
    }
    if (parts.length === 3 && parts[2] === 'reject' && method === 'POST') {
      await p.query('UPDATE alerts SET status=?, cleared_at=NOW() WHERE id=?', ['expired', parts[1]]);
      const [[a]] = await p.query('SELECT * FROM alerts WHERE id=?', [parts[1]]);
      await audit({ id: a?.marshal_id, name: a?.marshal_name, role: 'marshal' }, 'alert_rejected', 'alert', parts[1], { incidentId: a?.incident_id });
      return ok({ ok: true });
    }
  }

  // ----- INCIDENT REPORTS (marshal closes & reports to SHO) -----
  if (parts[0] === 'incident-reports') {
    if (method === 'POST' && parts.length === 1) {
      const { incidentId, marshalId, summary, finalSeverity } = body;
      const [[inc]] = await p.query('SELECT reported_by FROM incidents WHERE id=?', [incidentId]);
      const id = uuidv4();
      await p.query('INSERT INTO incident_reports (id,incident_id,marshal_id,sho_id,summary,final_severity) VALUES (?,?,?,?,?,?)',
        [id, incidentId, marshalId, inc?.reported_by || null, summary || null, finalSeverity || null]);
      // close incident automatically
      await p.query('UPDATE incidents SET status=?, cleared_at=NOW(), cleared_by=? WHERE id=? AND status<>?', ['cleared', marshalId, incidentId, 'cleared']);
      await p.query('UPDATE alerts SET status=?, cleared_at=NOW() WHERE incident_id=?', ['cleared', incidentId]);
      // award points
      const [[old]] = await p.query('SELECT created_at FROM incidents WHERE id=?', [incidentId]);
      const minutes = old ? (Date.now() - new Date(old.created_at).getTime()) / 60000 : 0;
      const points = Math.max(50, Math.floor(150 - minutes * 5));
      await p.query('UPDATE marshals SET points = points + ? WHERE id=?', [points, marshalId]);
      await audit({ id: marshalId, role: 'marshal' }, 'incident_report_submitted', 'incident', incidentId, { points, finalSeverity });
      return ok({ ok: true, points, id });
    }
    if (method === 'GET' && parts.length === 1) {
      const shoId = searchParams.get('shoId');
      let sql = `SELECT r.*, i.address, i.lat, i.lng, i.severity AS orig_severity, u.name AS marshal_name
                 FROM incident_reports r
                 LEFT JOIN incidents i ON i.id=r.incident_id
                 LEFT JOIN users u ON u.id=r.marshal_id`;
      const args = [];
      if (shoId) { sql += ' WHERE r.sho_id=?'; args.push(shoId); }
      sql += ' ORDER BY r.cleared_at DESC LIMIT 100';
      const [rows] = await p.query(sql, args);
      return ok({ reports: rows.map(r => ({
        id: r.id, incidentId: r.incident_id, marshalId: r.marshal_id, marshalName: r.marshal_name,
        shoId: r.sho_id, summary: r.summary, finalSeverity: r.final_severity,
        clearedAt: r.cleared_at, address: r.address,
        location: r.lat ? { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] } : null,
        originalSeverity: r.orig_severity,
      })) });
    }
  }

  // ----- AUDIT LOGS -----
  if (parts[0] === 'admin' && parts[1] === 'audit' && method === 'GET') {
    const action = searchParams.get('action');
    const role = searchParams.get('role');
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const args = [];
    if (action) { sql += ' AND action=?'; args.push(action); }
    if (role) { sql += ' AND actor_role=?'; args.push(role); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const [rows] = await p.query(sql, args);
    return ok({ logs: rows.map(r => ({
      id: r.id, actorId: r.actor_id, actorName: r.actor_name, actorRole: r.actor_role,
      action: r.action, targetType: r.target_type, targetId: r.target_id,
      details: (() => { try { return r.details ? JSON.parse(r.details) : null; } catch { return r.details; } })(),
      createdAt: r.created_at,
    })) });
  }

  // ----- ACTIVITIES -----
  if (parts[0] === 'activities') {
    if (method === 'POST' && parts.length === 1) {
      const { marshalId, marshalName, lat, lng, address, severity, description, photoUrl } = body;
      const id = uuidv4();
      await p.query(
        'INSERT INTO activities (id,marshal_id,marshal_name,lat,lng,address,severity,description,photo_url) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, marshalId, marshalName || 'Unknown', lat ?? null, lng ?? null, address || '', severity || 'medium', description || '', photoUrl || null]
      );
      if (marshalId) await p.query('UPDATE marshals SET points = points + 25 WHERE id=?', [marshalId]);
      const [[r]] = await p.query('SELECT * FROM activities WHERE id=?', [id]);
      return ok({ activity: activityRow(r), pointsAwarded: 25 });
    }
    if (method === 'GET' && parts.length === 1) {
      const [rows] = await p.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 100');
      return ok({ activities: rows.map(activityRow) });
    }
  }

  // ----- DCP -----
  if (parts[0] === 'dcp' && parts.length >= 2) {
    const dcpId = parts[1];
    // Get TPS under DCP's assigned zones (preferred new endpoint)
    if (parts.length === 3 && parts[2] === 'tps' && method === 'GET') {
      const [zoneRows] = await p.query('SELECT z.id, z.name FROM dcp_zones m JOIN zones z ON z.id=m.zone_id WHERE m.dcp_id=?', [dcpId]);
      if (!zoneRows.length) return ok({ tps: [], zones: [] });
      const zIds = zoneRows.map(z => z.id);
      const ph = zIds.map(() => '?').join(',');
      const [tpsRows] = await p.query(
        `SELECT t.*, z.name AS zone_name FROM traffic_ps t LEFT JOIN zones z ON z.id=t.zone_id WHERE t.zone_id IN (${ph}) ORDER BY z.name, t.name`,
        zIds
      );
      return ok({
        zones: zoneRows,
        tps: tpsRows.map(t => ({
          id: t.id, name: t.name, zoneId: t.zone_id, zoneName: t.zone_name,
          address: t.address, lat: t.lat ? Number(t.lat) : null, lng: t.lng ? Number(t.lng) : null,
          polygon: (() => { try { return t.polygon ? JSON.parse(t.polygon) : null; } catch { return null; } })(),
        })),
      });
    }
    if (parts.length === 3 && parts[2] === 'shos' && method === 'GET') {
      const [rows] = await p.query(
        `SELECT u.id, u.username, u.name, u.phone, u.zone, u.created_at
         FROM dcp_sho_mappings m JOIN users u ON u.id = m.sho_id WHERE m.dcp_id=?`,
        [dcpId]
      );
      return ok({ shos: rows });
    }
    if (parts.length === 3 && parts[2] === 'shos' && method === 'POST') {
      const { shoId } = body;
      if (!shoId) return err('shoId required');
      try {
        await p.query('INSERT INTO dcp_sho_mappings (id,dcp_id,sho_id) VALUES (?,?,?)', [uuidv4(), dcpId, shoId]);
      } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
      return ok({ ok: true });
    }
    if (parts.length === 4 && parts[2] === 'shos' && method === 'DELETE') {
      await p.query('DELETE FROM dcp_sho_mappings WHERE dcp_id=? AND sho_id=?', [dcpId, parts[3]]);
      return ok({ ok: true });
    }
    if (parts.length === 3 && parts[2] === 'incidents' && method === 'GET') {
      const shoFilter = searchParams.get('shoId');
      const range = searchParams.get('range') || 'live';
      // Get DCP's zones → TPS → incidents
      const [zoneRows] = await p.query('SELECT zone_id FROM dcp_zones WHERE dcp_id=?', [dcpId]);
      const zoneIds = zoneRows.map(r => r.zone_id);
      if (zoneIds.length === 0) return ok({ incidents: [] });
      const zPlace = zoneIds.map(() => '?').join(',');
      const [tpsRows] = await p.query(`SELECT id FROM traffic_ps WHERE zone_id IN (${zPlace})`, zoneIds);
      const tpsIds = tpsRows.map(t => t.id);
      // Also include legacy via ps_id fallback for old data
      const [mapped] = await p.query('SELECT sho_id FROM dcp_sho_mappings WHERE dcp_id=?', [dcpId]);
      const legacyShoIds = mapped.map(r => r.sho_id);
      const allIds = [...new Set([...tpsIds, ...legacyShoIds])];
      if (allIds.length === 0) return ok({ incidents: [] });
      const filterIds = shoFilter && shoFilter !== 'all' ? [shoFilter] : allIds;
      let dateClause = '';
      if (range === 'live') dateClause = "AND status IN ('open','dispatched')";
      else if (range === 'today') dateClause = "AND DATE(created_at) = CURDATE()";
      else if (range === '24h') dateClause = "AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)";
      const placeholders = filterIds.map(() => '?').join(',');
      const [rows] = await p.query(
        `SELECT * FROM incidents WHERE (ps_id IN (${placeholders}) OR tps_id IN (${placeholders})) ${dateClause} ORDER BY created_at DESC LIMIT 200`,
        [...filterIds, ...filterIds]
      );
      return ok({ incidents: rows.map(incidentRow) });
    }
    if (parts.length === 3 && parts[2] === 'stats' && method === 'GET') {
      const [zoneRows] = await p.query('SELECT zone_id FROM dcp_zones WHERE dcp_id=?', [dcpId]);
      const zoneIds = zoneRows.map(r => r.zone_id);
      if (zoneIds.length === 0) return ok({ stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0, cleared: 0, active: 0 } });
      const zPlace = zoneIds.map(() => '?').join(',');
      const [tpsRows] = await p.query(`SELECT id FROM traffic_ps WHERE zone_id IN (${zPlace})`, zoneIds);
      const tpsIds = tpsRows.map(t => t.id);
      const [mapped] = await p.query('SELECT sho_id FROM dcp_sho_mappings WHERE dcp_id=?', [dcpId]);
      const legacyShoIds = mapped.map(r => r.sho_id);
      const allIds = [...new Set([...tpsIds, ...legacyShoIds])];
      if (allIds.length === 0) return ok({ stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0, cleared: 0, active: 0 } });
      const placeholders = allIds.map(() => '?').join(',');
      const [[stats]] = await p.query(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN severity='critical' AND status!='cleared' THEN 1 ELSE 0 END) AS critical,
          SUM(CASE WHEN severity='high' AND status!='cleared' THEN 1 ELSE 0 END) AS high,
          SUM(CASE WHEN severity='medium' AND status!='cleared' THEN 1 ELSE 0 END) AS medium,
          SUM(CASE WHEN severity='low' AND status!='cleared' THEN 1 ELSE 0 END) AS low_count,
          SUM(CASE WHEN status='cleared' THEN 1 ELSE 0 END) AS cleared,
          SUM(CASE WHEN status IN ('open','dispatched') THEN 1 ELSE 0 END) AS active
         FROM incidents WHERE (ps_id IN (${placeholders}) OR tps_id IN (${placeholders}))`,
        [...allIds, ...allIds]
      );
      return ok({ stats: { ...stats, low: stats.low_count } });
    }
    if (parts.length === 3 && parts[2] === 'analytics' && method === 'GET') {
      const [zoneRows] = await p.query('SELECT zone_id FROM dcp_zones WHERE dcp_id=?', [dcpId]);
      const zoneIds = zoneRows.map(r => r.zone_id);
      if (zoneIds.length === 0) return ok({ hourly: [], psWise: [] });
      const zPlace = zoneIds.map(() => '?').join(',');
      const [tpsRows] = await p.query(`SELECT id FROM traffic_ps WHERE zone_id IN (${zPlace})`, zoneIds);
      const tpsIds = tpsRows.map(t => t.id);
      const [mapped] = await p.query('SELECT sho_id FROM dcp_sho_mappings WHERE dcp_id=?', [dcpId]);
      const legacyShoIds = mapped.map(r => r.sho_id);
      const allIds = [...new Set([...tpsIds, ...legacyShoIds])];
      if (allIds.length === 0) return ok({ hourly: [], psWise: [] });
      const placeholders = allIds.map(() => '?').join(',');
      const [hourly] = await p.query(
        `SELECT HOUR(created_at) AS hour, COUNT(*) AS count
         FROM incidents WHERE (ps_id IN (${placeholders}) OR tps_id IN (${placeholders})) AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         GROUP BY HOUR(created_at) ORDER BY hour ASC`,
        [...allIds, ...allIds]
      );
      const [psWise] = await p.query(
        `SELECT COALESCE(i.tps_id, i.ps_id) AS ps_id, COALESCE(t.name, u.name) AS ps_name, COUNT(*) AS count,
                AVG(i.estimated_delay_min) AS avg_delay
         FROM incidents i
         LEFT JOIN traffic_ps t ON t.id = i.tps_id
         LEFT JOIN users u ON u.id = i.ps_id
         WHERE (i.ps_id IN (${placeholders}) OR i.tps_id IN (${placeholders}))
         GROUP BY COALESCE(i.tps_id, i.ps_id), COALESCE(t.name, u.name)`,
        [...allIds, ...allIds]
      );
      return ok({ hourly, psWise });
    }
  }

  // ----- FAMILIES (Senior Citizen Protection) -----
  if (parts[0] === 'families') {
    if (method === 'GET' && parts.length === 1) {
      const shoId = searchParams.get('shoId');
      const dcpId = searchParams.get('dcpId');
      let sql = 'SELECT * FROM senior_families';
      const wh = []; const args = [];
      if (shoId) {
        const [[sho]] = await p.query('SELECT tps_id FROM users WHERE id=? AND role=?', [shoId, 'sho']);
        if (!sho?.tps_id) return ok({ families: [] });
        wh.push('(ps_id=? OR tps_id=?)'); args.push(sho.tps_id, sho.tps_id);
      }
      if (dcpId) {
        const [zoneRows] = await p.query('SELECT zone_id FROM dcp_zones WHERE dcp_id=?', [dcpId]);
        const zoneIds = zoneRows.map(r => r.zone_id);
        if (!zoneIds.length) return ok({ families: [] });
        const zPlace = zoneIds.map(() => '?').join(',');
        const [tpsRows] = await p.query(`SELECT id FROM traffic_ps WHERE zone_id IN (${zPlace})`, zoneIds);
        const tpsIds = tpsRows.map(t => t.id);
        if (!tpsIds.length) return ok({ families: [] });
        const tPlace = tpsIds.map(() => '?').join(',');
        wh.push(`(ps_id IN (${tPlace}) OR tps_id IN (${tPlace}) OR dcp_id=?)`);
        args.push(...tpsIds, ...tpsIds, dcpId);
      }
      if (wh.length) sql += ' WHERE ' + wh.join(' AND ');
      sql += ' ORDER BY created_at DESC';
      const [rows] = await p.query(sql, args);
      return ok({ families: rows.map(familyRow) });
    }
    if (method === 'POST' && parts.length === 1) {
      const id = uuidv4();
      const [[{ c }]] = await p.query('SELECT COUNT(*) AS c FROM senior_families');
      const familyCode = `FAM-${String(c + 1).padStart(4, '0')}`;
      const b = body;
      let psId = b.psId || null;
      let tpsId = b.tpsId || b.psId || null;
      let zoneName = b.zone || null;
      if (b.createdBy) {
        const [[creator]] = await p.query(
          `SELECT u.role, u.tps_id, t.name AS tps_name, z.name AS zone_name
           FROM users u
           LEFT JOIN traffic_ps t ON t.id=u.tps_id
           LEFT JOIN zones z ON z.id=t.zone_id
           WHERE u.id=?`,
          [b.createdBy]
        );
        if (creator?.role === 'sho' && creator?.tps_id) {
          psId = creator.tps_id;
          tpsId = creator.tps_id;
          zoneName = creator.zone_name || zoneName;
        }
      }
      await p.query(
        `INSERT INTO senior_families
         (id,family_code,senior_name,age,gender,mobile,alt_contact,address,landmark,ps_id,tps_id,dcp_id,zone,
          emergency_contact_name,emergency_contact_phone,medical_conditions,doctor_name,hospital_name,medication_notes,
          lat,lng,risk_category,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, familyCode, b.seniorName, b.age || null, b.gender || null, b.mobile || null, b.altContact || null,
         b.address || null, b.landmark || null, psId, tpsId, b.dcpId || null, zoneName,
         b.emergencyContactName || null, b.emergencyContactPhone || null, b.medicalConditions || null,
         b.doctorName || null, b.hospitalName || null, b.medicationNotes || null,
         b.lat || null, b.lng || null, b.riskCategory || 'low', b.createdBy || null]
      );
      const [[fresh]] = await p.query('SELECT * FROM senior_families WHERE id=?', [id]);
      return ok({ family: familyRow(fresh) });
    }
    if (parts.length === 2 && method === 'GET') {
      const [[r]] = await p.query('SELECT * FROM senior_families WHERE id=?', [parts[1]]);
      if (!r) return err('Not found', 404);
      return ok({ family: familyRow(r) });
    }
    if (parts.length === 2 && method === 'PATCH') {
      const b = body;
      const fields = {
        senior_name: b.seniorName, age: b.age, gender: b.gender, mobile: b.mobile,
        alt_contact: b.altContact, address: b.address, landmark: b.landmark,
        ps_id: b.psId, tps_id: b.tpsId || b.psId, dcp_id: b.dcpId, zone: b.zone,
        emergency_contact_name: b.emergencyContactName, emergency_contact_phone: b.emergencyContactPhone,
        medical_conditions: b.medicalConditions, doctor_name: b.doctorName,
        hospital_name: b.hospitalName, medication_notes: b.medicationNotes,
        lat: b.lat, lng: b.lng, risk_category: b.riskCategory,
      };
      const sets = [], vals = [];
      Object.entries(fields).forEach(([k, v]) => { if (v !== undefined) { sets.push(`${k}=?`); vals.push(v); } });
      if (sets.length) {
        vals.push(parts[1]);
        await p.query(`UPDATE senior_families SET ${sets.join(', ')} WHERE id=?`, vals);
      }
      return ok({ ok: true });
    }
    if (parts.length === 2 && method === 'DELETE') {
      await p.query('DELETE FROM senior_families WHERE id=?', [parts[1]]);
      await p.query('DELETE FROM family_assignments WHERE family_id=?', [parts[1]]);
      return ok({ ok: true });
    }
  }

  // ----- ASSIGNMENTS -----
  if (parts[0] === 'assignments') {
    if (method === 'GET' && parts.length === 1) {
      const marshalId = searchParams.get('marshalId');
      const familyId = searchParams.get('familyId');
      let sql = `SELECT a.*, f.senior_name AS family_name, f.address AS family_address,
                        f.mobile AS family_mobile, f.lat AS family_lat, f.lng AS family_lng,
                        f.risk_category AS family_risk, f.medical_conditions AS family_medical
                 FROM family_assignments a LEFT JOIN senior_families f ON f.id = a.family_id`;
      const wh = []; const args = [];
      if (marshalId) { wh.push('a.marshal_id=?'); args.push(marshalId); }
      if (familyId) { wh.push('a.family_id=?'); args.push(familyId); }
      if (wh.length) sql += ' WHERE ' + wh.join(' AND ');
      sql += ' ORDER BY a.created_at DESC';
      const [rows] = await p.query(sql, args);
      return ok({ assignments: rows.map(r => ({
        ...assignmentRow(r),
        family: {
          name: r.family_name, address: r.family_address, mobile: r.family_mobile,
          lat: r.family_lat ? Number(r.family_lat) : null,
          lng: r.family_lng ? Number(r.family_lng) : null,
          riskCategory: r.family_risk, medical: r.family_medical,
        }
      })) });
    }
    if (method === 'POST' && parts.length === 1) {
      const { familyId, marshalId, visitFrequency, instructions, assignedBy } = body;
      if (!familyId || !marshalId) return err('familyId and marshalId required');
      const id = uuidv4();
      await p.query(
        'INSERT INTO family_assignments (id,family_id,marshal_id,visit_frequency,instructions,assigned_by) VALUES (?,?,?,?,?,?)',
        [id, familyId, marshalId, visitFrequency || 'weekly', instructions || null, assignedBy || null]
      );
      const [[r]] = await p.query('SELECT * FROM family_assignments WHERE id=?', [id]);
      return ok({ assignment: assignmentRow(r) });
    }
    if (parts.length === 2 && method === 'DELETE') {
      await p.query('DELETE FROM family_assignments WHERE id=?', [parts[1]]);
      return ok({ ok: true });
    }
  }

  // ----- VISITS -----
  if (parts[0] === 'visits') {
    if (method === 'POST' && parts.length === 1) {
      const id = uuidv4();
      const b = body;
      await p.query(
        `INSERT INTO visit_logs
         (id, assignment_id, family_id, marshal_id, marshal_name, family_name,
          lat, lng, address, selfie_photo, visit_start, visit_end, family_condition, notes, signature)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, b.assignmentId || null, b.familyId, b.marshalId, b.marshalName || null, b.familyName || null,
         b.lat || null, b.lng || null, b.address || null, b.selfiePhoto || null,
         b.visitStart ? new Date(b.visitStart) : new Date(), b.visitEnd ? new Date(b.visitEnd) : null,
         b.familyCondition || 'safe', b.notes || null, b.signature || null]
      );
      // Update assignment status to completed
      if (b.assignmentId) {
        await p.query('UPDATE family_assignments SET status=? WHERE id=?', ['completed', b.assignmentId]);
      }
      // Award points
      if (b.marshalId) await p.query('UPDATE marshals SET points = points + 30 WHERE id=?', [b.marshalId]);
      // Auto-escalation if family condition requires
      let escalationId = null;
      if (b.familyCondition && b.familyCondition !== 'safe') {
        const prioMap = { medical: 'high', emergency: 'critical', police_followup: 'high' };
        escalationId = uuidv4();
        await p.query(
          'INSERT INTO escalations (id,visit_id,family_id,raised_by,priority,reason) VALUES (?,?,?,?,?,?)',
          [escalationId, id, b.familyId, b.marshalId, prioMap[b.familyCondition] || 'medium',
            `Family condition: ${b.familyCondition}. Notes: ${b.notes || 'No notes'}`]
        );
        if (b.assignmentId) {
          await p.query('UPDATE family_assignments SET status=? WHERE id=?', ['escalated', b.assignmentId]);
        }
      }
      const [[r]] = await p.query('SELECT * FROM visit_logs WHERE id=?', [id]);
      return ok({ visit: visitRow(r), pointsAwarded: 30, escalationId });
    }
    if (method === 'GET' && parts.length === 1) {
      const marshalId = searchParams.get('marshalId');
      const familyId = searchParams.get('familyId');
      let sql = 'SELECT * FROM visit_logs';
      const wh = []; const args = [];
      if (marshalId) { wh.push('marshal_id=?'); args.push(marshalId); }
      if (familyId) { wh.push('family_id=?'); args.push(familyId); }
      if (wh.length) sql += ' WHERE ' + wh.join(' AND ');
      sql += ' ORDER BY created_at DESC LIMIT 200';
      const [rows] = await p.query(sql, args);
      return ok({ visits: rows.map(visitRow) });
    }
  }

  // ----- ESCALATIONS -----
  if (parts[0] === 'escalations') {
    if (method === 'GET' && parts.length === 1) {
      const dcpId = searchParams.get('dcpId');
      let sql = `SELECT e.*, f.senior_name AS family_name, f.family_code, f.dcp_id AS family_dcp, u.name AS marshal_name
                 FROM escalations e
                 LEFT JOIN senior_families f ON f.id = e.family_id
                 LEFT JOIN users u ON u.id = e.raised_by`;
      const args = [];
      if (dcpId) { sql += ' WHERE f.dcp_id=?'; args.push(dcpId); }
      sql += ' ORDER BY e.created_at DESC LIMIT 100';
      const [rows] = await p.query(sql, args);
      return ok({ escalations: rows.map(r => ({
        ...escalationRow(r), familyName: r.family_name, familyCode: r.family_code, marshalName: r.marshal_name,
      })) });
    }
    if (parts.length === 3 && parts[2] === 'ack' && method === 'POST') {
      const { ackBy } = body;
      await p.query("UPDATE escalations SET status='acknowledged', ack_by=?, ack_at=NOW() WHERE id=?", [ackBy || null, parts[1]]);
      return ok({ ok: true });
    }
    if (parts.length === 3 && parts[2] === 'resolve' && method === 'POST') {
      await p.query("UPDATE escalations SET status='resolved' WHERE id=?", [parts[1]]);
      return ok({ ok: true });
    }
  }

  // ----- ADMIN USERS -----
  if (parts[0] === 'admin' && parts[1] === 'users') {
    if (method === 'GET' && parts.length === 2) {
      const [rows] = await p.query(`SELECT u.id, u.username, u.name, u.role, u.phone, u.zone, u.zone_id, u.tps_id, u.created_at,
        z.name AS zone_name, t.name AS tps_name FROM users u LEFT JOIN zones z ON z.id=u.zone_id LEFT JOIN traffic_ps t ON t.id=u.tps_id ORDER BY u.created_at DESC`);
      // gather DCP zone mappings
      const [dz] = await p.query('SELECT dcp_id, zone_id FROM dcp_zones');
      const dzMap = {};
      dz.forEach(r => { if (!dzMap[r.dcp_id]) dzMap[r.dcp_id] = []; dzMap[r.dcp_id].push(r.zone_id); });
      return ok({ users: rows.map(r => ({
        id: r.id, username: r.username, name: r.name, role: r.role, phone: r.phone, zone: r.zone,
        zoneId: r.zone_id, zoneName: r.zone_name, tpsId: r.tps_id, tpsName: r.tps_name,
        zoneIds: dzMap[r.id] || [], createdAt: r.created_at,
      })) });
    }
    if (method === 'POST' && parts.length === 2) {
      const { username, password, name, role, phone, zoneId, tpsId, zoneIds, lat, lng } = body;
      if (!username || !password || !name || !role) return err('Missing fields');
      const [[exists]] = await p.query('SELECT id FROM users WHERE username=?', [username]);
      if (exists) return err('Username already exists');
      const id = uuidv4();
      // Resolve zone name for legacy column
      let zoneName = null;
      if (zoneId) { const [[z]] = await p.query('SELECT name FROM zones WHERE id=?', [zoneId]); zoneName = z?.name || null; }
      await p.query('INSERT INTO users (id,username,password,name,role,phone,zone,zone_id,tps_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, username, password, name, role, phone || '', zoneName, zoneId || null, tpsId || null]);
      if (role === 'marshal' || role === 'volunteer') {
        // marshals table: use TPS-derived lat/lng if not provided
        let defLat = lat, defLng = lng;
        if (tpsId && (defLat == null || defLng == null)) {
          const [[t]] = await p.query('SELECT lat, lng FROM traffic_ps WHERE id=?', [tpsId]);
          if (t) { defLat = defLat ?? t.lat; defLng = defLng ?? t.lng; }
        }
        await p.query('INSERT INTO marshals (id,user_id,name,role,zone,status,lat,lng,points,tps_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [id, id, name, role, zoneName || '', 'offline', defLat ?? 17.45, defLng ?? 78.5, 0, tpsId || null]);
      }
      if (role === 'dcp' && Array.isArray(zoneIds)) {
        for (const zid of zoneIds) {
          try { await p.query('INSERT INTO dcp_zones (id,dcp_id,zone_id) VALUES (?,?,?)', [uuidv4(), id, zid]); } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
        }
      }
      return ok({ user: { id, username, name, role, phone: phone || '', zoneId, tpsId, zoneIds: zoneIds || [] } });
    }
    if (parts.length === 3) {
      const userId = parts[2];
      if (method === 'PATCH') {
        const { name, phone, password, role, zoneId, tpsId, zoneIds } = body;
        // resolve zone name
        let zoneName;
        if (zoneId !== undefined) {
          if (zoneId) { const [[z]] = await p.query('SELECT name FROM zones WHERE id=?', [zoneId]); zoneName = z?.name || null; }
          else zoneName = null;
        }
        const sets = [], vals = [];
        if (name !== undefined) { sets.push('name=?'); vals.push(name); }
        if (phone !== undefined) { sets.push('phone=?'); vals.push(phone); }
        if (zoneName !== undefined) { sets.push('zone=?'); vals.push(zoneName); sets.push('zone_id=?'); vals.push(zoneId || null); }
        if (tpsId !== undefined) { sets.push('tps_id=?'); vals.push(tpsId || null); }
        if (password) { sets.push('password=?'); vals.push(password); }
        if (role) { sets.push('role=?'); vals.push(role); }
        if (sets.length) { vals.push(userId); await p.query(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, vals); }
        // sync marshal table
        const mSets = [], mVals = [];
        if (name !== undefined) { mSets.push('name=?'); mVals.push(name); }
        if (zoneName !== undefined) { mSets.push('zone=?'); mVals.push(zoneName || ''); }
        if (tpsId !== undefined) { mSets.push('tps_id=?'); mVals.push(tpsId || null); }
        if (role && (role === 'marshal' || role === 'volunteer')) { mSets.push('role=?'); mVals.push(role); }
        if (mSets.length) { mVals.push(userId); await p.query(`UPDATE marshals SET ${mSets.join(', ')} WHERE id=?`, mVals); }
        // sync DCP zones
        if (Array.isArray(zoneIds)) {
          await p.query('DELETE FROM dcp_zones WHERE dcp_id=?', [userId]);
          for (const zid of zoneIds) {
            try { await p.query('INSERT INTO dcp_zones (id,dcp_id,zone_id) VALUES (?,?,?)', [uuidv4(), userId, zid]); } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
          }
        }
        return ok({ ok: true });
      }
      if (method === 'DELETE') {
        await p.query('DELETE FROM users WHERE id=?', [userId]);
        await p.query('DELETE FROM marshals WHERE id=?', [userId]);
        return ok({ ok: true });
      }
    }
  }

  // ----- ADMIN REPORTS -----
  if (parts[0] === 'admin') {
    if (parts[1] === 'attendance' && method === 'GET') {
      const [marshals] = await p.query('SELECT * FROM marshals');
      const [logs] = await p.query(
        "SELECT marshal_id, COUNT(*) AS cnt FROM activity_logs WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND action IN ('online','offline','active') GROUP BY marshal_id"
      );
      const cntMap = Object.fromEntries(logs.map(l => [l.marshal_id, l.cnt]));
      const report = marshals.map(m => ({
        id: m.id, name: m.name, zone: m.zone, role: m.role, status: m.status,
        toggleCount: cntMap[m.id] || 0,
        lastSeen: m.last_updated,
      }));
      return ok({ attendance: report });
    }
    if (parts[1] === 'leaderboard' && method === 'GET') {
      const [rows] = await p.query('SELECT * FROM marshals ORDER BY points DESC LIMIT 20');
      return ok({ leaderboard: rows.map(marshalRow) });
    }
    if (parts[1] === 'stats' && method === 'GET') {
      const [[{ total }]] = await p.query('SELECT COUNT(*) AS total FROM marshals');
      const [[{ active }]] = await p.query("SELECT COUNT(*) AS active FROM marshals WHERE status='active'");
      const [[{ online }]] = await p.query("SELECT COUNT(*) AS online FROM marshals WHERE status='online'");
      const [[{ offline }]] = await p.query("SELECT COUNT(*) AS offline FROM marshals WHERE status='offline'");
      const [[{ incidents }]] = await p.query('SELECT COUNT(*) AS incidents FROM incidents');
      const [[{ open }]] = await p.query("SELECT COUNT(*) AS open FROM incidents WHERE status IN ('open','dispatched')");
      const [[{ cleared }]] = await p.query("SELECT COUNT(*) AS cleared FROM incidents WHERE status='cleared'");
      const [[{ families }]] = await p.query('SELECT COUNT(*) AS families FROM senior_families');
      const [[{ openEsc }]] = await p.query("SELECT COUNT(*) AS openEsc FROM escalations WHERE status='open'");
      return ok({ stats: { total, active, online, offline, incidents, open, cleared, families, openEscalations: openEsc } });
    }
  }

  return err('Route not found', 404);
}

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
export async function PUT(request) { return handle(request); }
export async function PATCH(request) { return handle(request); }
export async function DELETE(request) { return handle(request); }
