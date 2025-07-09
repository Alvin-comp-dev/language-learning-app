import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import monitoring from '../config/monitoring';

interface EncryptedData {
  iv: string;
  data: string;
  tag?: string;
}

class EncryptionService {
  private static instance: EncryptionService;
  private readonly ENCRYPTION_KEY_PREFIX = 'encryption_key:';
  private readonly KEY_ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private userKeys: Map<string, CryptoKey> = new Map();

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  async initializeUserEncryption(userId: string): Promise<void> {
    try {
      // Check if user already has a key
      const existingKey = await this.getUserKey(userId);
      if (existingKey) {
        this.userKeys.set(userId, existingKey);
        return;
      }

      // Generate new encryption key
      const key = await this.generateEncryptionKey();
      
      // Store the key securely
      await this.storeUserKey(userId, key);
      
      this.userKeys.set(userId, key);
    } catch (error) {
      console.error('Failed to initialize user encryption:', error);
      monitoring.trackError(error as Error, { context: 'initializeUserEncryption' });
    }
  }

  private async generateEncryptionKey(): Promise<CryptoKey> {
    try {
      return await Crypto.subtle.generateKey(
        {
          name: this.KEY_ALGORITHM,
          length: this.KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      throw error;
    }
  }

  private async getUserKey(userId: string): Promise<CryptoKey | null> {
    try {
      const storedKey = await AsyncStorage.getItem(`${this.ENCRYPTION_KEY_PREFIX}${userId}`);
      if (!storedKey) return null;

      const keyData = JSON.parse(storedKey);
      return await Crypto.subtle.importKey(
        'jwk',
        keyData,
        {
          name: this.KEY_ALGORITHM,
          length: this.KEY_LENGTH,
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to get user key:', error);
      return null;
    }
  }

  private async storeUserKey(userId: string, key: CryptoKey): Promise<void> {
    try {
      const exportedKey = await Crypto.subtle.exportKey('jwk', key);
      await AsyncStorage.setItem(
        `${this.ENCRYPTION_KEY_PREFIX}${userId}`,
        JSON.stringify(exportedKey)
      );
    } catch (error) {
      console.error('Failed to store user key:', error);
      throw error;
    }
  }

  async encryptData(userId: string, data: any): Promise<EncryptedData> {
    try {
      const key = this.userKeys.get(userId);
      if (!key) {
        throw new Error('Encryption key not found');
      }

      // Generate random IV
      const iv = Crypto.getRandomValues(new Uint8Array(12));

      // Convert data to string if needed
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Encode data
      const encodedData = new TextEncoder().encode(dataString);

      // Encrypt
      const encryptedBuffer = await Crypto.subtle.encrypt(
        {
          name: this.KEY_ALGORITHM,
          iv,
        },
        key,
        encodedData
      );

      // Convert to base64
      const encryptedBase64 = Buffer.from(encryptedBuffer).toString('base64');
      const ivBase64 = Buffer.from(iv).toString('base64');

      return {
        iv: ivBase64,
        data: encryptedBase64,
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      monitoring.trackError(error as Error, { context: 'encryptData' });
      throw error;
    }
  }

  async decryptData(userId: string, encryptedData: EncryptedData): Promise<any> {
    try {
      const key = this.userKeys.get(userId);
      if (!key) {
        throw new Error('Decryption key not found');
      }

      // Decode IV and data from base64
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const data = Buffer.from(encryptedData.data, 'base64');

      // Decrypt
      const decryptedBuffer = await Crypto.subtle.decrypt(
        {
          name: this.KEY_ALGORITHM,
          iv,
        },
        key,
        data
      );

      // Decode result
      const decryptedText = new TextDecoder().decode(decryptedBuffer);

      // Parse JSON if possible
      try {
        return JSON.parse(decryptedText);
      } catch {
        return decryptedText;
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      monitoring.trackError(error as Error, { context: 'decryptData' });
      throw error;
    }
  }

  async encryptConversation(userId: string, conversation: any): Promise<EncryptedData> {
    try {
      // Remove sensitive data from conversation before encryption
      const sanitizedConversation = this.sanitizeConversationData(conversation);
      
      return await this.encryptData(userId, sanitizedConversation);
    } catch (error) {
      console.error('Failed to encrypt conversation:', error);
      monitoring.trackError(error as Error, { context: 'encryptConversation' });
      throw error;
    }
  }

  private sanitizeConversationData(conversation: any): any {
    // Remove any sensitive data that shouldn't be stored
    const { audioData, rawTranscription, ...sanitizedData } = conversation;
    return sanitizedData;
  }

  async rotateUserKey(userId: string): Promise<void> {
    try {
      // Generate new key
      const newKey = await this.generateEncryptionKey();

      // Get all encrypted data for user
      const { data: encryptedData, error } = await fetch(`/api/users/${userId}/encrypted-data`).then(res => res.json());

      if (error) throw error;

      // Re-encrypt all data with new key
      const reencryptedData = await Promise.all(
        encryptedData.map(async (item: { id: string; data: EncryptedData }) => {
          const decrypted = await this.decryptData(userId, item.data);
          const reencrypted = await this.encryptData(userId, decrypted);
          return { id: item.id, data: reencrypted };
        })
      );

      // Update stored data with re-encrypted versions
      await fetch(`/api/users/${userId}/encrypted-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: reencryptedData }),
      });

      // Store new key
      await this.storeUserKey(userId, newKey);
      this.userKeys.set(userId, newKey);

      // Log key rotation
      monitoring.trackEvent('encryption_key_rotated', { userId });
    } catch (error) {
      console.error('Failed to rotate user key:', error);
      monitoring.trackError(error as Error, { context: 'rotateUserKey' });
      throw error;
    }
  }

  async clearUserEncryption(userId: string): Promise<void> {
    try {
      // Remove key from memory
      this.userKeys.delete(userId);

      // Remove stored key
      await AsyncStorage.removeItem(`${this.ENCRYPTION_KEY_PREFIX}${userId}`);

      monitoring.trackEvent('encryption_cleared', { userId });
    } catch (error) {
      console.error('Failed to clear user encryption:', error);
      monitoring.trackError(error as Error, { context: 'clearUserEncryption' });
    }
  }
}

export default EncryptionService.getInstance(); 