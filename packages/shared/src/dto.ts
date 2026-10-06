import type {
  Category,
  EventType,
  HistoryReason,
  IncidentStatus,
  PriorityLevel,
  RiskLevel,
  Role,
  SpaceType,
} from './enums';
import type { PriorityBreakdown } from './domain/priority';
import type { Point3, SimilarityBreakdown } from './domain/similarity-score';
import type { TransitionRule } from './domain/transition-policy';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SpaceDTO {
  id: string;
  code: string;
  name: string;
  floor: number;
  type: SpaceType;
  capacity: number;
  qrToken: string;
  localX: number;
  localZ: number;
}

export interface BlockDTO {
  id: string;
  code: string;
  name: string;
  posX: number;
  posZ: number;
  width: number;
  depth: number;
  floors: number;
  rotation: number;
  spaces: SpaceDTO[];
}

export interface CampusDTO {
  id: string;
  code: string;
  name: string;
  blocks: BlockDTO[];
}

export interface SpaceRefDTO {
  id: string;
  code: string;
  name: string;
  type: SpaceType;
  floor: number;
  capacity: number;
  block: { id: string; code: string; name: string };
  campus: { id: string; code: string; name: string };
}

export interface PersonRefDTO {
  id: string;
  name: string;
  role: Role;
}

export interface IncidentDTO {
  id: string;
  number: number;
  code: string;
  description: string;
  category: Category;
  riskLevel: RiskLevel;
  status: IncidentStatus;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityBreakdown: PriorityBreakdown;
  escalationSteps: number;
  isOverdue: boolean;
  responseDueAt: string;
  resolutionDueAt: string;
  slaWarnedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stageStartedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
  hotspot: Point3 | null;
  space: SpaceRefDTO;
  reporter: PersonRefDTO;
  assignee: PersonRefDTO | null;
  clusterId: string | null;
  isClusterPrimary: boolean;
  clusterSize: number;
  thumbnailUrl: string | null;
}

export interface EvidenceDTO {
  id: string;
  stage: 'REPORT' | 'FIX';
  kind: 'PHOTO' | 'TEXT';
  url: string | null;
  text: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface StatusHistoryDTO {
  id: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  changedBy: PersonRefDTO | null;
  changedAt: string;
  durationInPrevMs: number | null;
  reason: HistoryReason;
  note: string | null;
}

export interface IncidentEventDTO {
  id: string;
  type: EventType;
  payload: Record<string, unknown>;
  actor: PersonRefDTO | null;
  createdAt: string;
}

export interface ClusterMemberDTO {
  id: string;
  code: string;
  description: string;
  status: IncidentStatus;
  createdAt: string;
  isClusterPrimary: boolean;
  reporterName: string;
  similarity: SimilarityBreakdown | null;
}

export interface IncidentDetailDTO extends IncidentDTO {
  evidence: EvidenceDTO[];
  history: StatusHistoryDTO[];
  events: IncidentEventDTO[];
  clusterMembers: ClusterMemberDTO[];
  availableTransitions: TransitionRule[];
}

export interface DuplicateCandidateDTO {
  incident: IncidentDTO;
  similarity: SimilarityBreakdown;
  explanation: string;
  decision: 'group' | 'suggest' | 'none';
}

export interface PriorityPreviewDTO {
  score: number;
  level: PriorityLevel;
  breakdown: PriorityBreakdown;
  responseHours: number;
  resolutionHours: number;
  duplicates: DuplicateCandidateDTO[];
}

export interface GroupSuggestionDTO {
  id: string;
  score: number;
  breakdown: SimilarityBreakdown;
  explanation: string;
  createdAt: string;
  incident: IncidentDTO;
  candidate: IncidentDTO;
}

export interface DashboardSummaryDTO {
  open: number;
  overdue: number;
  inProgress: number;
  resolvedToday: number;
  verifiedTotal: number;
  slaCompliance: number | null;
  byLevel: Record<PriorityLevel, number>;
}

export interface ResolutionTimeDTO {
  level: PriorityLevel;
  count: number;
  avgMs: number | null;
  medianMs: number | null;
}

export interface TopSpaceDTO {
  spaceId: string;
  spaceName: string;
  spaceCode: string;
  blockName: string;
  campusName: string;
  total: number;
  open: number;
}

export interface SlaComplianceDTO {
  level: PriorityLevel;
  total: number;
  onTime: number;
  rate: number | null;
}

export interface HeatCellDTO {
  blockId: string;
  blockName: string;
  category: Category;
  open: number;
}

export interface SnapshotIncidentDTO {
  id: string;
  code: string;
  spaceId: string;
  category: Category;
  status: IncidentStatus;
  level: PriorityLevel;
  isOverdue: boolean;
  clusterId: string | null;
  hotspot: Point3 | null;
}

export interface SnapshotDTO {
  at: string;
  from: string;
  to: string;
  incidents: SnapshotIncidentDTO[];
}
