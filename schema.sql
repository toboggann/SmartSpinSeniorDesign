-- SmartSpin Database Schema
-- Run this file directly in MySQL Workbench.
-- It will create the database and all tables automatically.

CREATE DATABASE IF NOT EXISTS SmartSpin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE SmartSpin;


CREATE TABLE IF NOT EXISTS Accounts (
  AccountID    INT             NOT NULL AUTO_INCREMENT,
  Username     VARCHAR(64)     NOT NULL,
  Email        VARCHAR(255)    NOT NULL,
  PasswordHash VARCHAR(255)    NOT NULL,
  CreatedAt    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  LastLogin    DATETIME                 DEFAULT NULL,
  IsActive     TINYINT(1)      NOT NULL DEFAULT 1,

  PRIMARY KEY (AccountID),
  UNIQUE KEY uq_accounts_email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS Sessions (
  SessionID    INT             NOT NULL AUTO_INCREMENT,
  SessionToken VARCHAR(128)    NOT NULL,
  AccountID    INT             NOT NULL,
  CreatedAt    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ExpiresAt    DATETIME        NOT NULL,

  PRIMARY KEY (SessionID),
  UNIQUE KEY uq_sessions_token (SessionToken),
  KEY idx_sessions_account (AccountID),
  CONSTRAINT fk_sessions_account
    FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



CREATE TABLE IF NOT EXISTS Appliances (
  ApplianceID  INT             NOT NULL AUTO_INCREMENT,
  AccountID    INT             NOT NULL,
  Type         ENUM('washer','dryer','combo') NOT NULL,
  Brand        VARCHAR(128)             DEFAULT NULL,
  ModelNumber  VARCHAR(128)    NOT NULL,
  NickName     VARCHAR(128)             DEFAULT NULL,
  ManualText   MEDIUMTEXT               DEFAULT NULL,
  CreatedAt    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (ApplianceID),
  KEY idx_appliances_account (AccountID),
  CONSTRAINT fk_appliances_account
    FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



CREATE TABLE IF NOT EXISTS ScanHistory (
  ScanID              INT           NOT NULL AUTO_INCREMENT,
  AccountID           INT           NOT NULL,
  ScanType            ENUM('clothing_tag','appliance') NOT NULL,
  ImageURL            VARCHAR(512)           DEFAULT NULL,
  RawResult           JSON                   DEFAULT NULL,
  ParsedInstructions  TEXT                   DEFAULT NULL,
  CreatedAt           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (ScanID),
  KEY idx_scanhistory_account (AccountID),
  CONSTRAINT fk_scanhistory_account
    FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS SavedInstructions (
  InstructionID       INT           NOT NULL AUTO_INCREMENT,
  AccountID           INT           NOT NULL,
  Title               VARCHAR(128)  NOT NULL,
  GarmentDescription  TEXT                   DEFAULT NULL,
  WashTemp            VARCHAR(64)            DEFAULT NULL,
  CycleType           VARCHAR(64)            DEFAULT NULL,
  DryerSetting        VARCHAR(64)            DEFAULT NULL,
  SpecialNotes        TEXT                   DEFAULT NULL,
  CreatedAt           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (InstructionID),
  KEY idx_savedinstructions_account (AccountID),
  CONSTRAINT fk_savedinstructions_account
    FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS Reminders (
  ReminderID      INT             NOT NULL AUTO_INCREMENT,
  AccountID       INT             NOT NULL,
  Title           VARCHAR(128)    NOT NULL,
  ReminderDate    DATETIME        NOT NULL,
  RepeatInterval  ENUM('daily','weekly','biweekly','monthly') DEFAULT NULL,
  IsActive        TINYINT(1)      NOT NULL DEFAULT 1,
  CreatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (ReminderID),
  KEY idx_reminders_account (AccountID),
  KEY idx_reminders_date (ReminderDate),
  CONSTRAINT fk_reminders_account
    FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;