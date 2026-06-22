import { YStack, FinanceDashboard, Spinner, AppHeader, Container } from '@blinkdotnew/mobile-ui';
import { useQuery } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['projects', 'proj_1'],
    queryFn: () => blink.db.projects.get('proj_1'),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'proj_1'],
    queryFn: () => blink.db.tasks.list({ where: { project_id: 'proj_1' } }),
  });

  if (projectLoading || tasksLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" color="$color9" />
      </YStack>
    );
  }

  const completedCount = tasks?.filter((t: any) => Number(t.is_completed) > 0).length || 0;
  const totalCount = tasks?.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Container safeArea edges={['top']} backgroundColor="$background">
      <AppHeader title="App Finisher" />
      <FinanceDashboard
        title={project?.name || 'Project Dashboard'}
        balance={`${progressPercent}%`}
        balanceLabel="Launch Readiness"
        rangeLabel="Updated just now"
        metrics={[
          { label: 'Completed', value: String(completedCount), change: '↑ Done' },
          { label: 'Remaining', value: String(totalCount - completedCount), change: '↓ To-do' },
        ]}
        quickActions={[
          { id: 'add', label: 'Add Task', icon: <Ionicons name="list" size={18} color="white" /> },
          { id: 'launch', label: 'Launch', icon: <Ionicons name="rocket" size={18} color="white" /> },
        ]}
        sections={[
          {
            title: 'Recent Activity',
            rows: tasks?.slice(0, 3).map((t: any) => ({
              id: t.id,
              title: t.title,
              subtitle: t.category.toUpperCase(),
              value: Number(t.is_completed) > 0 ? '✓' : '•',
              color: Number(t.is_completed) > 0 ? '$green9' : '$color10',
            })) || [],
          },
        ]}
      />
    </Container>
  );
}