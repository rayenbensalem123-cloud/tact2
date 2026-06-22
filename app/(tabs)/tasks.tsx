import { YStack, Container, AppHeader, ListItem, ScrollView, Badge, Spinner, XStack, SizableText, Button } from '@blinkdotnew/mobile-ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { Ionicons } from '@expo/vector-icons';

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', 'proj_1'],
    queryFn: () => blink.db.tasks.list({ where: { project_id: 'proj_1' }, orderBy: { created_at: 'asc' } }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: number }) => {
      return blink.db.tasks.update(id, { is_completed: is_completed > 0 ? 0 : 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'proj_1'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'proj_1'] });
    },
  });

  if (isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" color="$color9" />
      </YStack>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ui': return 'color-palette-outline';
      case 'database': return 'server-outline';
      case 'auth': return 'lock-closed-outline';
      default: return 'document-text-outline';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ui': return '$blue9';
      case 'database': return '$orange9';
      case 'auth': return '$purple9';
      default: return '$color9';
    }
  };

  return (
    <Container safeArea edges={['top']} backgroundColor="$background">
      <AppHeader title="Tasks Checklist" />
      <ScrollView>
        <YStack padding="$4" gap="$3">
          {tasks?.map((task: any) => (
            <ListItem
              key={task.id}
              title={task.title}
              subtitle={task.description}
              icon={
                <YStack 
                  padding="$2" 
                  borderRadius="$3" 
                  backgroundColor={Number(task.is_completed) > 0 ? '$green3' : '$color3'}
                >
                  <Ionicons 
                    name={Number(task.is_completed) > 0 ? 'checkmark-circle' : getCategoryIcon(task.category)} 
                    size={20} 
                    color={Number(task.is_completed) > 0 ? '$green9' : getCategoryColor(task.category)} 
                  />
                </YStack>
              }
              onPress={() => toggleMutation.mutate({ id: task.id, is_completed: Number(task.is_completed) })}
              right={
                <Badge variant={Number(task.is_completed) > 0 ? 'success' : 'gray'}>
                  {Number(task.is_completed) > 0 ? 'Done' : 'To-do'}
                </Badge>
              }
            />
          ))}
        </YStack>
      </ScrollView>
    </Container>
  );
}
