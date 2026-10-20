import { prisma } from "@/lib/prisma";
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, proto, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";

/**
 * DB key for an auth item. MySQL's default collation is case-insensitive, but app-state key ids are base64,
 * where "AAAAAFkE" and "AAAAAFke" are different keys: they collided in one row, the wrong key was read back and
 * app-state sync failed ("bad decrypt"), so archive/pin/delete chat never reached the phone. Uppercase letters are
 * escaped so every id maps to a distinct, case-insensitively unique key (ids without uppercase stay as they were).
 */
export const authKey = (type: string, id: string) => `${type}-${id}`.replace(/[A-Z]/g, c => `^${c.toLowerCase()}`);

export const usePrismaAuthState = async (sessionId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    
    // Helper to read JSON with Buffer handling
    const readData = async (type: string, id: string) => {
        try {
            const key = authKey(type, id);
            const data = await prisma.authState.findUnique({
                where: { sessionId_key: { sessionId, key } }
            });
            if (data && data.value) {
                return JSON.parse(JSON.stringify(data.value), BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            logger.error("Auth", 'Error reading auth state:', error);
            return null;
        }
    };

    // Helper to write data
    const writeData = async (type: string, id: string, data: any) => {
        try {
            const key = authKey(type, id);
            const value = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
            
            await prisma.authState.upsert({
                where: { sessionId_key: { sessionId, key } },
                create: { sessionId, key, value },
                update: { value }
            });
        } catch (error) {
             logger.error("Auth", 'Error writing auth state:', error);
        }
    };

    const removeData = async (type: string, id: string) => {
        try {
            const key = authKey(type, id);
             await prisma.authState.deleteMany({
                where: { sessionId, key }
            });
        } catch (error) {
            // ignore
        }
    }


    const creds: AuthenticationCreds = (await readData('creds', 'me')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(type, id);
                        if (type === 'app-state-sync-key' && value) {
                            // keyData is stored as a base64 string; fromObject turns it back into bytes (as Baileys'
                            // own auth state does). Without it the string itself was used as the key: "bad decrypt"
                            // on every app-state sync, so archive/pin/delete chat never reached the phone.
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        if (value) {
                            data[id] = value;
                        }
                    }));
                    return data;
                },
                set: async (data) => {
                     const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        const categoryData = data[category as keyof typeof data];
                        if (!categoryData) continue;
                        
                        for (const id in categoryData) {
                            const value = categoryData[id];
                             if (value) {
                                tasks.push(writeData(category, id, value));
                            } else {
                                tasks.push(removeData(category, id));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', 'me', creds);
        }
    }
}
