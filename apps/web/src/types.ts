export type {
  Project as ProjectDocument,
  UINode as ProjectNode,
  Page as ProjectPage,
  NodeStyle,
  TokenOrValue,
  DesignToken,
  Theme,
  ComponentDefinition
} from "../../../packages/schema/src/types";

export interface ProjectSummary { id: string; name: string; updatedAt?: string; }
export interface LoadedProject {
  project: import("../../../packages/schema/src/types").Project;
  recoveredFromBackup?: boolean;
}
