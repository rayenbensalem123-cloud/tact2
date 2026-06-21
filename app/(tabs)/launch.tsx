import { YStack, Container, AppHeader, Card, Button, H2, Paragraph, XStack, SizableText, Badge, Spinner } from '@blinkdotnew/mobile-ui';
import { useQuery } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { Ionicons } from '@expo/vector-icons';

export default function LaunchScreen() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', 'proj_1'],
    queryFn: () => blink.db.tasks.list({ where: { project_id: 'proj_1' } }),
  });

  if (isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" color="$color9" />
      </YStack>
    );
  }

  const completedCount = tasks?.filter((t: any) => Number(t.is_completed) > 0).length || 0;
  const totalCount = tasks?.length || 0;
  const isReady = completedCount === totalCount;

  return (
    <Container safeArea edges={['top']} backgroundColor="$background">
      <AppHeader title="Launch Readiness" />
      <YStack padding="$4" gap="$4" flex={1}>
        <Card bordered backgroundColor="$color2" padding="$4">
          <YStack alignItems="center" gap="$3" paddingVertical="$4">
            <YStack 
              padding="$4" 
              borderRadius="$10" 
              backgroundColor={isReady ? '$green3' : '$orange3'}
            >
              <Ionicons name="rocket" size={48} color={isReady ? '$green9' : '$orange9'} />
            </YStack>
            <H2 textAlign="center">{isReady ? 'Ready for Lift-off!' : 'Final Polish Needed'}</H2>
            <Paragraph color="$color10" textAlign="center">
              {completedCount} of {totalCount} core tasks completed.
            </Paragraph>
          </YStack>
        </Card>

        <YStack gap="$3">
          <SizableText fontWeight="700" size="$4">Launch Checklist</SizableText>
          
          <XStack alignItems="center" gap="$3" backgroundColor="$color2" padding="$3" borderRadius="$4">
            <Ionicons name="shield-checkmark" size={20} color="$color11" />
            <SizableText flex={1}>Privacy Policy & Terms</SizableText>
            <Badge variant="success">PASS</Badge>
          </XStack>

          <XStack alignItems="center" gap="$3" backgroundColor="$color2" padding="$3" borderRadius="$4">
            <Ionicons name="phone-portrait" size={20} color="$color11" />
            <SizableText flex={1}>App Store Assets</SizableText>
            <Badge variant="success">READY</Badge>
          </XStack>

          <XStack alignItems="center" gap="$3" backgroundColor="$color2" padding="$3" borderRadius="$4">
            <Ionicons name="globe" size={20} color="$color11" />
            <SizableText flex={1}>Deployment Environment</SizableText>
            <Badge variant="warning">PENDING</Badge>
          </XStack>
        </YStack>

        <YStack flex={1} />

        <Button 
          theme={isReady ? 'active' : 'gray'} 
          size="$6" 
          disabled={!isReady}
          onPress={() => alert('Launching to App Store...')}
        >
          Submit to App Store
        </Button>
      </YStack>
    </Container>
  );
}
