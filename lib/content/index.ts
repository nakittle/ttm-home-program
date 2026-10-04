import posturesJson from "@/content/postures.json";
import groupsJson from "@/content/groups.json";
import redflagsJson from "@/content/redflags.json";
import { GroupsFileSchema, PostureSchema, RedFlagsFileSchema, type Group, type Posture, type RedFlagRule } from "./schema";

export const postures: Posture[] = PostureSchema.array().parse(posturesJson);
export const groupsFile = GroupsFileSchema.parse(groupsJson);
export const redflags = RedFlagsFileSchema.parse(redflagsJson);

const postureById = new Map(postures.map((p) => [p.id, p]));

export function getPosture(id: string): Posture {
  const p = postureById.get(id);
  if (!p) throw new Error(`unknown posture ${id}`);
  return p;
}

export function activeGroups(): Group[] {
  return groupsFile.groups.filter((g) => g.active);
}

export function getGroup(id: string): Group {
  const g = groupsFile.groups.find((x) => x.id === id);
  if (!g) throw new Error(`unknown group ${id}`);
  return g;
}

/** Posture ids for the chosen groups, in sheet order, each posture once (kae-puat-thong-sabak-chom is in two sheets). */
export function posturesForGroups(groupIds: string[]): string[] {
  const out: string[] = [];
  for (const gid of groupIds) for (const pid of getGroup(gid).posture_ids) if (!out.includes(pid)) out.push(pid);
  return out;
}

export function sheetUrl(sheet: number): string {
  return groupsFile.sheets[String(sheet)].url;
}

/** "ที่มา: ..." credit line shown under every posture. */
export function creditLine(p: Posture): string {
  const s = groupsFile.sheets[String(p.source.sheet)];
  return `ที่มา: ${groupsFile.series_title_th} ${s.title_th} ${groupsFile.publisher_th} ${groupsFile.year_be} หน้า ${p.source.page}`;
}

export function rulesAskedAt(at: RedFlagRule["ask_at"][number], postureId?: string): RedFlagRule[] {
  return redflags.rules.filter(
    (r) => r.ask_at.includes(at) && (r.postures === null || (postureId !== undefined && r.postures.includes(postureId))),
  );
}
