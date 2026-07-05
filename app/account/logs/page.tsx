import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import prisma from '@/lib/db';
import { MainNavbar } from '@/components/main-navbar';
import { Clock, Activity, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Activity Logs | Pusdatin Security Toolkit',
  description: 'View your recent activity logs',
};

async function getLogs(userId: string) {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Fetch top 100
    });
    return logs;
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return [];
  }
}

export default async function ActivityLogsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/login');
  }

  const logs = await getLogs(session.user.id);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(date));
  };

  const getBadgeColor = (action: string) => {
    if (action.includes('STOP') || action.includes('LOGOUT')) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (action.includes('START') || action.includes('LOGIN')) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (action.includes('SEARCH') || action.includes('CVE')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-background overflow-hidden relative">
      {/* Background Pattern */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />
      <div className="absolute inset-0 bg-grid-pattern radial-mask pointer-events-none opacity-40" />

      <div className="relative z-10 flex flex-col w-full h-full">
        <MainNavbar />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Activity className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Activity Logs</h1>
            <p className="text-sm text-gray-400">View your recent actions and scans</p>
          </div>
        </div>

        <Card className="glass-effect hover-effect">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activities</CardTitle>
            <CardDescription>Showing up to 100 most recent activities on your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-300">No activity yet</h3>
                <p className="text-sm text-gray-500">Your recent actions will appear here.</p>
              </div>
            ) : (
              <div className="rounded-md border border-gray-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-800/50">
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="w-[200px] text-gray-400">Date & Time</TableHead>
                      <TableHead className="w-[200px] text-gray-400">Action</TableHead>
                      <TableHead className="text-gray-400">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="border-gray-800 hover:bg-gray-800/30">
                        <TableCell className="font-medium text-gray-300 flex items-center gap-2">
                          <Clock className="h-3 w-3 text-gray-500" />
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {log.details || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
