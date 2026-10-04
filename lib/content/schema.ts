import { z } from "zod";

/** Point names a rule may use. {S}/{O}/{V} are replaced per side at run time (lib/pose/rules.ts). */
export const PointName = z.string().regex(/^(\{S\}|\{O\}|\{V\}|L|R|MID)?_?[A-Z_]+$/);

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { angle: [string, string, string]; gte?: number; lte?: number }
  | { above: [string, string]; by: number }
  | { below: [string, string]; by: number }
  | { near: [string, string]; within: number }
  | { level: [string, string]; within: number }
  | { xdist: [string, string]; gte?: number; lte?: number }
  | { toward: [string, string]; by: number }
  | { drop: [string]; by: number }
  | { between: [string, string, string] }
  | { proj: [string, string, string]; min: number; max: number };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ any: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z.object({ angle: z.tuple([PointName, PointName, PointName]), gte: z.number().optional(), lte: z.number().optional() }).strict(),
    z.object({ above: z.tuple([PointName, PointName]), by: z.number() }).strict(),
    z.object({ below: z.tuple([PointName, PointName]), by: z.number() }).strict(),
    z.object({ near: z.tuple([PointName, PointName]), within: z.number().positive() }).strict(),
    z.object({ level: z.tuple([PointName, PointName]), within: z.number().positive() }).strict(),
    z.object({ xdist: z.tuple([PointName, PointName]), gte: z.number().optional(), lte: z.number().optional() }).strict(),
    z.object({ toward: z.tuple([PointName, z.enum(["{S}", "{O}", "L", "R"])]), by: z.number() }).strict(),
    z.object({ drop: z.tuple([PointName]), by: z.number() }).strict(),
    z.object({ between: z.tuple([PointName, PointName, PointName]) }).strict(),
    z.object({ proj: z.tuple([PointName, PointName, PointName]), min: z.number(), max: z.number() }).strict(),
  ]),
);

export const DetectorSchema = z.object({
  view: z.enum(["front", "side"]),
  sides: z.enum(["both", "alternate", "visible"]),
  first_side: z.enum(["L", "R"]).nullable(),
  mode: z.enum(["hold", "reps"]),
  hold_seconds: z.number().positive(),
  units: z.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  required: z.array(PointName).min(1),
  in_pose: ConditionSchema,
});

export const PostureSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  position: z.enum(["sitting_floor", "standing", "kneeling"]),
  steps_th: z.array(z.string().min(1)).min(1),
  note_th: z.string().nullable(),
  cautions_th: z.array(z.string()),
  contraindications_th: z.array(z.string()),
  source: z.object({
    sheet: z.number().int(),
    page: z.number().int(),
    also: z.object({ sheet: z.number().int(), page: z.number().int() }).optional(),
  }),
  detector: DetectorSchema,
});

export const GroupsFileSchema = z.object({
  series_title_th: z.string(),
  publisher_th: z.string(),
  year_be: z.number().int(),
  sheets: z.record(z.string(), z.object({ title_th: z.string(), url: z.url() })),
  groups: z.array(
    z.object({
      id: z.string(),
      name_th: z.string(),
      sheet: z.number().int(),
      active: z.boolean(),
      posture_ids: z.array(z.string()),
    }),
  ),
});

export const RedFlagLevel = z.enum(["call_1669", "stop_and_contact_clinic", "pause_posture", "note_for_next_visit"]);

export const RedFlagRuleSchema = z.object({
  id: z.string().regex(/^RF\d{2}$/),
  level: RedFlagLevel,
  ask_at: z.array(z.enum(["pre", "during", "post", "before_posture"])),
  postures: z.array(z.string()).nullable(),
  question_th: z.string().min(1),
  trigger: z.discriminatedUnion("type", [
    z.object({ type: z.literal("yes") }),
    z.object({ type: z.literal("pain_gte"), value: z.number() }),
    z.object({ type: z.literal("pain_delta_gte"), value: z.number() }),
    z.object({ type: z.literal("yes_and_pain_delta_lte"), value: z.number() }),
  ]),
  patient_message_th: z.string().min(1),
  source_th: z.string().min(1),
  strength: z.enum(["stated", "derived", "team"]),
  clinic_adjustable: z.boolean(),
});

export const RedFlagsFileSchema = z.object({ label_th: z.string(), rules: z.array(RedFlagRuleSchema).min(1) });

export type Detector = z.infer<typeof DetectorSchema>;
export type Posture = z.infer<typeof PostureSchema>;
export type GroupsFile = z.infer<typeof GroupsFileSchema>;
export type Group = GroupsFile["groups"][number];
export type RedFlagRule = z.infer<typeof RedFlagRuleSchema>;
export type RedFlagLevel = z.infer<typeof RedFlagLevel>;
