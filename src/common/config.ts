/* eslint-disable no-console */
import json5 from 'json5';
import fs from 'fs';
import path from 'path';
import { config as dotenv } from 'dotenv';

dotenv();

export interface Account {
  email: string;
  password: string;
  totp?: string;
}

export interface SmtpAuth {
  user: string;
  pass: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  emailSenderAddress: string;
  emailSenderName: string;
  emailRecipientAddress: string;
  secure: boolean;
  auth?: SmtpAuth;
}

export interface PartialEmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  emailSenderAddress?: string;
  emailSenderName?: string;
  emailRecipientAddress?: string;
  secure?: boolean;
  auth?: Partial<SmtpAuth>;
}

export interface PartialConfig {
  accounts?: Partial<Account>[];
  onlyWeekly?: boolean;
  runOnStartup?: boolean;
  cronSchedule?: string;
  logLevel?: string;
  baseUrl?: string;
  serverPort?: number;
  email?: PartialEmailConfig;
}

export interface ConfigObject extends PartialConfig {
  accounts: Account[];
  onlyWeekly: boolean;
  runOnStartup: boolean;
  cronSchedule: string;
  logLevel: string;
  baseUrl: string;
  serverPort: number;
  email: EmailConfig;
}

const EXTENSIONS = ['json', 'json5']; // Allow .json or .json5 extension
const CONFIG_DIR = 'config';
const CONFIG_FILE_NAME = 'config';

function validateConfig(config: PartialConfig): ConfigObject {
  // console.debug('Parsing config');
  try {
    if (!config.accounts || config.accounts.length < 1) {
      throw new Error('At least one account is required');
    }
    config.accounts.forEach((account, index) => {
      if (!account.email) {
        throw new Error(`Account ${index + 1} is missing email`);
      }
      if (!account.password) {
        throw new Error(`Account ${index + 1} is missing password`);
      }
    });

    if (!config.email) throw new Error('Email config is required for captcha notification');
    if (!config.email.smtpHost) throw new Error('Incomplete email config: smtpHost');
    if (!config.email.smtpPort) throw new Error('Incomplete email config: smtpPort');
    if (!config.email.emailSenderAddress)
      throw new Error('Incomplete email config: emailSenderAddress');
    if (!config.email.emailSenderName) throw new Error('Incomplete email config: emailSenderName');
    if (!config.email.emailRecipientAddress)
      throw new Error('Incomplete email config: emailRecipientAddress');
    if (config.email.secure === undefined) throw new Error('Incomplete email config: secure');
    if (config.email.auth && !config.email.auth.user)
      throw new Error('Missing user from email auth config');
    if (config.email.auth && !config.email.auth.pass)
      throw new Error('Missing pass from email auth config');

    const validConfig: ConfigObject = {
      accounts: (config.accounts as unknown) as Account[], // Native type checking doesn't work through arrays?
      onlyWeekly: config.onlyWeekly || false,
      runOnStartup: config.runOnStartup || true,
      cronSchedule: config.cronSchedule || '0 12 * * *',
      logLevel: config.logLevel || 'info',
      baseUrl: config.baseUrl || 'http://localhost:3000',
      serverPort: config.serverPort || 3000,
      email: (config.email as unknown) as EmailConfig,
    };
    return validConfig;
  } catch (err) {
    // Can't use pino here due to circular dependency
    console.error(`CONFIGURATION ERROR: ${err.message}`);
    throw err;
  }
}

const configPaths = EXTENSIONS.map(ext => path.resolve(CONFIG_DIR, `${CONFIG_FILE_NAME}.${ext}`));

const configPath = configPaths.find(p => fs.existsSync(p));

let partialConfig: PartialConfig = {};
if (configPath) {
  partialConfig = json5.parse(fs.readFileSync(configPath, 'utf8'));
  if (partialConfig.accounts?.length === 0) {
    delete partialConfig.accounts; // Using undefined will spread overwrite incorrectly
  }
}

const envVarConfig: PartialConfig = {
  accounts: [
    {
      email: process.env.EMAIL,
      password: process.env.PASSWORD,
      totp: process.env.TOTP,
    },
  ],
  onlyWeekly: process.env.ONLY_WEEKLY ? Boolean(process.env.ONLY_WEEKLY) : undefined,
  runOnStartup: process.env.RUN_ON_STARTUP ? Boolean(process.env.RUN_ON_STARTUP) : undefined,
  cronSchedule: process.env.CRON_SCHEDULE,
  logLevel: process.env.LOG_LEVEL,
  baseUrl: process.env.BASE_URL,
  serverPort: Number(process.env.SERVER_PORT),
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT),
    emailSenderAddress: process.env.EMAIL_SENDER_ADDRESS,
    emailSenderName: process.env.EMAIL_SENDER_NAME,
    emailRecipientAddress: process.env.EMAIL_RECIPIENT_ADDRESS,
    secure: Boolean(process.env.SMTP_SECURE),
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  },
};

partialConfig = {
  ...envVarConfig,
  ...partialConfig,
};

export const config = validateConfig(partialConfig);
