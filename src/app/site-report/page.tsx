import AttendanceLedgerView from '@/components/AttendanceLedgerView';

export const metadata = {
  title: 'Site Ledger & Attendance Report | SS Realty',
  description: 'Verified construction attendance, monthly timesheet calendar, and daily work ledger.',
};

export default function SiteReportPage() {
  return <AttendanceLedgerView isAdmin={false} />;
}
