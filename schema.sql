-- ========================================================================
-- MKSC Traffic Marshal Coordination System - MySQL/MariaDB Schema
-- Compatible with XAMPP (MariaDB 10.x / MySQL 5.7+ / MySQL 8.x)
-- Import via phpMyAdmin: select database -> Import -> choose this file
-- ========================================================================

CREATE DATABASE IF NOT EXISTS `traffic_marshal_mksc`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `traffic_marshal_mksc`;

-- ---------- USERS ----------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`         VARCHAR(36)  NOT NULL PRIMARY KEY,
  `username`   VARCHAR(64)  NOT NULL UNIQUE,
  `password`   VARCHAR(128) NOT NULL,
  `name`       VARCHAR(128) NOT NULL,
  `role`       ENUM('super_admin','sho','marshal','volunteer') NOT NULL,
  `phone`      VARCHAR(20)  DEFAULT NULL,
  `zone`       VARCHAR(64)  DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_zone` (`zone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- MARSHALS ----------
DROP TABLE IF EXISTS `marshals`;
CREATE TABLE `marshals` (
  `id`            VARCHAR(36)   NOT NULL PRIMARY KEY,
  `user_id`       VARCHAR(36)   NOT NULL,
  `name`          VARCHAR(128)  NOT NULL,
  `role`          ENUM('marshal','volunteer') NOT NULL,
  `zone`          VARCHAR(64)   DEFAULT NULL,
  `status`        ENUM('online','offline','active') NOT NULL DEFAULT 'offline',
  `lat`           DECIMAL(10,7) NOT NULL,
  `lng`           DECIMAL(11,7) NOT NULL,
  `points`        INT           NOT NULL DEFAULT 0,
  `last_updated`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_marshals_status` (`status`),
  INDEX `idx_marshals_zone`   (`zone`),
  INDEX `idx_marshals_latlng` (`lat`, `lng`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- INCIDENTS ----------
DROP TABLE IF EXISTS `incidents`;
CREATE TABLE `incidents` (
  `id`           VARCHAR(36)   NOT NULL PRIMARY KEY,
  `reported_by`  VARCHAR(36)   DEFAULT NULL,
  `lat`          DECIMAL(10,7) NOT NULL,
  `lng`          DECIMAL(11,7) NOT NULL,
  `address`      VARCHAR(255)  DEFAULT NULL,
  `severity`     ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `photo_url`    LONGTEXT      DEFAULT NULL,
  `status`       ENUM('open','dispatched','cleared') NOT NULL DEFAULT 'open',
  `level`        TINYINT       NOT NULL DEFAULT 1,
  `cleared_by`   VARCHAR(36)   DEFAULT NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cleared_at`   DATETIME      DEFAULT NULL,
  INDEX `idx_incidents_status` (`status`),
  INDEX `idx_incidents_latlng` (`lat`, `lng`),
  INDEX `idx_incidents_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- ALERTS (dispatch records) ----------
DROP TABLE IF EXISTS `alerts`;
CREATE TABLE `alerts` (
  `id`            VARCHAR(36)   NOT NULL PRIMARY KEY,
  `incident_id`   VARCHAR(36)   NOT NULL,
  `marshal_id`    VARCHAR(36)   NOT NULL,
  `marshal_name`  VARCHAR(128)  DEFAULT NULL,
  `level`         TINYINT       NOT NULL,
  `distance_km`   DECIMAL(6,2)  NOT NULL,
  `status`        ENUM('pending','accepted','cleared','expired') NOT NULL DEFAULT 'pending',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at`   DATETIME      DEFAULT NULL,
  `cleared_at`    DATETIME      DEFAULT NULL,
  UNIQUE KEY `uniq_incident_marshal` (`incident_id`, `marshal_id`),
  INDEX `idx_alerts_marshal`  (`marshal_id`, `status`),
  INDEX `idx_alerts_incident` (`incident_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- ACTIVITY LOGS (online/offline + clears) ----------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id`           VARCHAR(36)  NOT NULL PRIMARY KEY,
  `marshal_id`   VARCHAR(36)  NOT NULL,
  `action`       VARCHAR(32)  NOT NULL,
  `incident_id`  VARCHAR(36)  DEFAULT NULL,
  `points`       INT          DEFAULT NULL,
  `timestamp`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_activitylog_marshal` (`marshal_id`),
  INDEX `idx_activitylog_ts`      (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- ACTIVITIES (field reports by marshals) ----------
DROP TABLE IF EXISTS `activities`;
CREATE TABLE `activities` (
  `id`            VARCHAR(36)   NOT NULL PRIMARY KEY,
  `marshal_id`    VARCHAR(36)   NOT NULL,
  `marshal_name`  VARCHAR(128)  DEFAULT NULL,
  `lat`           DECIMAL(10,7) DEFAULT NULL,
  `lng`           DECIMAL(11,7) DEFAULT NULL,
  `address`       VARCHAR(255)  DEFAULT NULL,
  `severity`      ENUM('low','medium','high','critical') DEFAULT 'medium',
  `description`   TEXT          DEFAULT NULL,
  `photo_url`     LONGTEXT      DEFAULT NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_activities_marshal` (`marshal_id`),
  INDEX `idx_activities_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================================================
-- DEMO SEED DATA (login credentials)
--   Super Admin : rksc       / rksc123
--   SHO         : sho1       / sho123        (Begumpet)
--   SHO         : sho2       / sho123        (Alwal)
--   Marshals    : marshal1.. / marshal123    (1-12, 3 per zone)
--   Volunteers  : volunteer1../ volunteer123 (1-8, 2 per zone)
-- ========================================================================

INSERT IGNORE INTO `users` (`id`,`username`,`password`,`name`,`role`,`phone`,`zone`) VALUES
('u-rksc','rksc','rksc123','RKSC Super Admin','super_admin','9999999999','All'),
('u-sho1','sho1','sho123','SHO Begumpet','sho','9000000001','Begumpet'),
('u-sho2','sho2','sho123','SHO Alwal','sho','9000000002','Alwal');

-- Marshals & Volunteers (3 marshals + 2 volunteers per zone)
INSERT IGNORE INTO `users` (`id`,`username`,`password`,`name`,`role`,`phone`,`zone`) VALUES
('u-m1','marshal1','marshal123','Marshal 1 (Begumpet)','marshal','9010000001','Begumpet'),
('u-m2','marshal2','marshal123','Marshal 2 (Begumpet)','marshal','9010000002','Begumpet'),
('u-m3','marshal3','marshal123','Marshal 3 (Begumpet)','marshal','9010000003','Begumpet'),
('u-m4','marshal4','marshal123','Marshal 4 (Alwal)','marshal','9010000004','Alwal'),
('u-m5','marshal5','marshal123','Marshal 5 (Alwal)','marshal','9010000005','Alwal'),
('u-m6','marshal6','marshal123','Marshal 6 (Alwal)','marshal','9010000006','Alwal'),
('u-m7','marshal7','marshal123','Marshal 7 (Thirumalgiri)','marshal','9010000007','Thirumalgiri'),
('u-m8','marshal8','marshal123','Marshal 8 (Thirumalgiri)','marshal','9010000008','Thirumalgiri'),
('u-m9','marshal9','marshal123','Marshal 9 (Thirumalgiri)','marshal','9010000009','Thirumalgiri'),
('u-m10','marshal10','marshal123','Marshal 10 (Uppal)','marshal','9010000010','Uppal'),
('u-m11','marshal11','marshal123','Marshal 11 (Uppal)','marshal','9010000011','Uppal'),
('u-m12','marshal12','marshal123','Marshal 12 (Uppal)','marshal','9010000012','Uppal'),
('u-v1','volunteer1','volunteer123','Volunteer 1 (Begumpet)','volunteer','9020000001','Begumpet'),
('u-v2','volunteer2','volunteer123','Volunteer 2 (Begumpet)','volunteer','9020000002','Begumpet'),
('u-v3','volunteer3','volunteer123','Volunteer 3 (Alwal)','volunteer','9020000003','Alwal'),
('u-v4','volunteer4','volunteer123','Volunteer 4 (Alwal)','volunteer','9020000004','Alwal'),
('u-v5','volunteer5','volunteer123','Volunteer 5 (Thirumalgiri)','volunteer','9020000005','Thirumalgiri'),
('u-v6','volunteer6','volunteer123','Volunteer 6 (Thirumalgiri)','volunteer','9020000006','Thirumalgiri'),
('u-v7','volunteer7','volunteer123','Volunteer 7 (Uppal)','volunteer','9020000007','Uppal'),
('u-v8','volunteer8','volunteer123','Volunteer 8 (Uppal)','volunteer','9020000008','Uppal');

INSERT IGNORE INTO `marshals` (`id`,`user_id`,`name`,`role`,`zone`,`status`,`lat`,`lng`,`points`) VALUES
('u-m1','u-m1','Marshal 1 (Begumpet)','marshal','Begumpet','active',17.4399,78.4738,120),
('u-m2','u-m2','Marshal 2 (Begumpet)','marshal','Begumpet','online',17.4420,78.4760,80),
('u-m3','u-m3','Marshal 3 (Begumpet)','marshal','Begumpet','offline',17.4380,78.4720,40),
('u-m4','u-m4','Marshal 4 (Alwal)','marshal','Alwal','active',17.4978,78.5036,150),
('u-m5','u-m5','Marshal 5 (Alwal)','marshal','Alwal','online',17.4995,78.5050,90),
('u-m6','u-m6','Marshal 6 (Alwal)','marshal','Alwal','offline',17.4960,78.5020,30),
('u-m7','u-m7','Marshal 7 (Thirumalgiri)','marshal','Thirumalgiri','active',17.4858,78.5132,110),
('u-m8','u-m8','Marshal 8 (Thirumalgiri)','marshal','Thirumalgiri','online',17.4870,78.5145,70),
('u-m9','u-m9','Marshal 9 (Thirumalgiri)','marshal','Thirumalgiri','offline',17.4845,78.5120,50),
('u-m10','u-m10','Marshal 10 (Uppal)','marshal','Uppal','active',17.4053,78.5594,180),
('u-m11','u-m11','Marshal 11 (Uppal)','marshal','Uppal','online',17.4070,78.5610,100),
('u-m12','u-m12','Marshal 12 (Uppal)','marshal','Uppal','offline',17.4035,78.5575,60),
('u-v1','u-v1','Volunteer 1 (Begumpet)','volunteer','Begumpet','online',17.4400,78.4750,55),
('u-v2','u-v2','Volunteer 2 (Begumpet)','volunteer','Begumpet','offline',17.4380,78.4720,25),
('u-v3','u-v3','Volunteer 3 (Alwal)','volunteer','Alwal','online',17.4980,78.5040,65),
('u-v4','u-v4','Volunteer 4 (Alwal)','volunteer','Alwal','offline',17.4950,78.5010,20),
('u-v5','u-v5','Volunteer 5 (Thirumalgiri)','volunteer','Thirumalgiri','online',17.4860,78.5135,75),
('u-v6','u-v6','Volunteer 6 (Thirumalgiri)','volunteer','Thirumalgiri','offline',17.4840,78.5115,35),
('u-v7','u-v7','Volunteer 7 (Uppal)','volunteer','Uppal','online',17.4055,78.5598,85),
('u-v8','u-v8','Volunteer 8 (Uppal)','volunteer','Uppal','offline',17.4030,78.5570,15);
