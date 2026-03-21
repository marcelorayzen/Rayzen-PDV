import fs from "node:fs";
import path from "node:path";

import type { MainProcessPaths } from "../paths.js";

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(cipherText: Buffer): string;
}

export interface FiscalSecretPayload {
  certificateBase64: string;
  certificatePassword: string;
  csc: string;
}

interface FiscalSecretFile {
  emitterId: string;
  provider: string;
  environment: string;
  updatedAt: string;
  values: {
    certificateBase64: string;
    certificatePassword: string;
    csc: string;
  };
}

export class FiscalSecretStore {
  readonly #paths: MainProcessPaths;
  readonly #safeStorage: SafeStorageLike;

  constructor(paths: MainProcessPaths, safeStorage: SafeStorageLike) {
    this.#paths = paths;
    this.#safeStorage = safeStorage;
  }

  isAvailable(): boolean {
    return this.#safeStorage.isEncryptionAvailable();
  }

  hasSecrets(emitterId: string): boolean {
    return fs.existsSync(this.#getFilePath(emitterId));
  }

  store(
    emitterId: string,
    metadata: { provider: string; environment: string; updatedAt: string },
    payload: FiscalSecretPayload
  ): { filePath: string; updatedAt: string } {
    if (!this.#safeStorage.isEncryptionAvailable()) {
      throw new Error("DPAPI local indisponivel para segredos fiscais.");
    }

    fs.mkdirSync(this.#paths.fiscalSecretsDir, { recursive: true });

    const filePath = this.#getFilePath(emitterId);
    const secretFile: FiscalSecretFile = {
      emitterId,
      provider: metadata.provider,
      environment: metadata.environment,
      updatedAt: metadata.updatedAt,
      values: {
        certificateBase64: this.#encrypt(payload.certificateBase64),
        certificatePassword: this.#encrypt(payload.certificatePassword),
        csc: this.#encrypt(payload.csc)
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(secretFile, null, 2));

    return {
      filePath,
      updatedAt: metadata.updatedAt
    };
  }

  read(emitterId: string): FiscalSecretPayload {
    const filePath = this.#getFilePath(emitterId);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Segredos fiscais nao encontrados para o emitente ${emitterId}.`);
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as FiscalSecretFile;

    return {
      certificateBase64: this.#decrypt(parsed.values.certificateBase64),
      certificatePassword: this.#decrypt(parsed.values.certificatePassword),
      csc: this.#decrypt(parsed.values.csc)
    };
  }

  #encrypt(value: string): string {
    return this.#safeStorage.encryptString(value).toString("base64");
  }

  #decrypt(value: string): string {
    return this.#safeStorage.decryptString(Buffer.from(value, "base64"));
  }

  #getFilePath(emitterId: string): string {
    return path.join(this.#paths.fiscalSecretsDir, `${emitterId}.json`);
  }
}
