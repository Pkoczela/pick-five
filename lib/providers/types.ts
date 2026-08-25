export type ExternalGame = {
  externalSource: "ESPN";
  externalEventId: string;
  kickoffAt: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINAL" | "POSTPONED" | "CANCELED";
  home: { externalTeamId: string; abbreviation: string; displayName: string; score: number | null };
  away: { externalTeamId: string; abbreviation: string; displayName: string; score: number | null };
};

export interface ScheduleProvider {
  getWeekSchedule(params: { year: number; week: number; seasonType: number }): Promise<ExternalGame[]>;
}
