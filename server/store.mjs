import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const COMPANIES = Object.freeze({
  tjt: "Tampereen Julkisivutekniikka Oy",
  "tjt-katto": "TJT Katto",
  previmek: "Previmek Oy",
});

const queues = new Map();
const locks = new Map();
const LOCK_MS = 120_000;

export function companyId(value) {
  return typeof value === "string" && Object.hasOwn(COMPANIES, value) ? value : null;
}

function filePath(dataDir, company) {
  if (!companyId(company)) throw new Error("Invalid company");
  return join(dataDir, company, "projects.json");
}

async function readDatabase(dataDir, company) {
  const path = filePath(dataDir, company);
  try {
    const content = JSON.parse(await readFile(path, "utf8"));
    if (!content || content.version !== 1 || !Array.isArray(content.projects)) throw new Error("Invalid database");
    return content;
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, company, projects: [] };
    throw error;
  }
}

async function writeDatabase(dataDir, company, database) {
  const path = filePath(dataDir, company);
  await mkdir(join(dataDir, company), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(database)}\n`, { flag: "wx" });
  await rename(temporary, path);
}

function serial(company, operation) {
  const previous = queues.get(company) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  queues.set(company, next);
  void next.finally(() => {
    if (queues.get(company) === next) queues.delete(company);
  }).catch(() => {});
  return next;
}

function key(company, projectId) {
  return `${company}:${projectId}`;
}

function liveLock(company, projectId) {
  const id = key(company, projectId);
  const value = locks.get(id);
  if (value && value.expiresAt <= Date.now()) locks.delete(id);
  return locks.get(id) ?? null;
}

function publicLock(lock) {
  return lock ? { userId: lock.userId, userName: lock.userName, expiresAt: new Date(lock.expiresAt).toISOString() } : null;
}

export class StoreError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function requireProject(db, id) {
  const project = db.projects.find((item) => item.id === id);
  if (!project) throw new StoreError(404, "Aikataulua ei löytynyt.");
  return project;
}

function validatePayload(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.tasks) || data.tasks.length === 0 || data.tasks.length > 3000) {
    throw new StoreError(400, "Aikataulun tiedot ovat virheelliset.");
  }
  if (typeof data.projectName !== "string" || data.projectName.length > 300 || typeof data.projectNumber !== "string" || data.projectNumber.length > 80) {
    throw new StoreError(400, "Projektin nimi tai numero on virheellinen.");
  }
  const bytes = Buffer.byteLength(JSON.stringify(data));
  if (bytes > 5_000_000) throw new StoreError(413, "Aikataulun koko ylittää rajan.");
}

export function createStore(dataDir) {
  return {
    async list(company) {
      const db = await readDatabase(dataDir, company);
      return db.projects.map(({ id, revision, data, updatedAt, updatedBy }) => ({
        id, revision, projectName: data.projectName, projectNumber: data.projectNumber,
        scheduleName: data.scheduleName, updatedAt, updatedBy, lock: publicLock(liveLock(company, id)),
      })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(company, id) {
      const project = requireProject(await readDatabase(dataDir, company), id);
      return { ...project, lock: publicLock(liveLock(company, id)) };
    },
    async create(company, actor, data) {
      validatePayload(data);
      return serial(company, async () => {
        const db = await readDatabase(dataDir, company);
        const project = { id: randomUUID(), revision: 1, data, updatedAt: new Date().toISOString(), updatedBy: actor.userName };
        db.projects.push(project);
        await writeDatabase(dataDir, company, db);
        locks.set(key(company, project.id), { userId: actor.userId, userName: actor.userName, expiresAt: Date.now() + LOCK_MS });
        return { ...project, lock: publicLock(liveLock(company, project.id)) };
      });
    },
    async acquire(company, id, actor, takeover = false) {
      return serial(company, async () => {
        requireProject(await readDatabase(dataDir, company), id);
        const current = liveLock(company, id);
        if (current && current.userId !== actor.userId && !takeover) {
          throw new StoreError(423, "Toinen käyttäjä muokkaa aikataulua.", { lock: publicLock(current) });
        }
        const lock = { userId: actor.userId, userName: actor.userName, expiresAt: Date.now() + LOCK_MS };
        locks.set(key(company, id), lock);
        return publicLock(lock);
      });
    },
    async release(company, id, actor, admin = false) {
      const current = liveLock(company, id);
      if (current && (current.userId === actor.userId || admin)) locks.delete(key(company, id));
      return null;
    },
    async update(company, id, actor, expectedRevision, data) {
      validatePayload(data);
      return serial(company, async () => {
        const db = await readDatabase(dataDir, company);
        const project = requireProject(db, id);
        const current = liveLock(company, id);
        if (!current || current.userId !== actor.userId) {
          throw new StoreError(423, "Muokkausvarausta ei ole. Muutoksia ei tallennettu.", { lock: publicLock(current) });
        }
        if (!Number.isSafeInteger(expectedRevision) || project.revision !== expectedRevision) {
          throw new StoreError(409, "Aikataulu on muuttunut toisessa istunnossa. Tallenna ensin JSON-varmuuskopio.", { revision: project.revision });
        }
        project.data = data;
        project.revision += 1;
        project.updatedAt = new Date().toISOString();
        project.updatedBy = actor.userName;
        await writeDatabase(dataDir, company, db);
        current.expiresAt = Date.now() + LOCK_MS;
        return { ...project, lock: publicLock(current) };
      });
    },
  };
}
