import type {
  Actor,
  AuditEntry,
  CuratedRoute,
  CuratedRouteInput,
  Pandal,
  PandalInput,
  Submission,
  SubmissionInput,
  SubmissionStatus,
} from "@/lib/domain/types";

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict" | "forbidden" | "unavailable" = "unavailable",
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

/** Reads and writes any visitor may perform. */
export interface PublicRepository {
  listPandals(): Promise<Pandal[]>;
  listCuratedRoutes(): Promise<CuratedRoute[]>;
  createSubmission(input: SubmissionInput): Promise<void>;
}

/**
 * Privileged operations. Callers must have passed `requireAdmin()` first; in
 * Supabase mode row-level security enforces the same rule again in the database.
 */
export interface AdminRepository {
  listAllPandals(): Promise<Pandal[]>;
  getPandal(id: string): Promise<Pandal | null>;
  createPandal(input: PandalInput, actor: Actor): Promise<Pandal>;
  updatePandal(id: string, input: PandalInput, actor: Actor): Promise<Pandal>;
  deletePandal(id: string, actor: Actor): Promise<void>;
  /** Upserts by slug. All-or-nothing. */
  importPandals(rows: PandalInput[], actor: Actor): Promise<{ created: number; updated: number }>;
  listAllCuratedRoutes(): Promise<CuratedRoute[]>;
  saveCuratedRoute(id: string | null, input: CuratedRouteInput, actor: Actor): Promise<CuratedRoute>;
  deleteCuratedRoute(id: string, actor: Actor): Promise<void>;
  listSubmissions(status?: SubmissionStatus): Promise<Submission[]>;
  reviewSubmission(
    id: string,
    status: Exclude<SubmissionStatus, "pending">,
    note: string | null,
    actor: Actor,
  ): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;
}
