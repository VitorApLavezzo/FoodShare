import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeStatus, SyncEventStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const HEARTBEAT_INTERVAL_MS = 15_000;
const OFFLINE_THRESHOLD_MS = 45_000;

@Injectable()
export class NodesService implements OnModuleInit {
  private readonly logger = new Logger(NodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.registerSelf();
    setInterval(() => this.heartbeat().catch((err) => this.logger.error(err)), HEARTBEAT_INTERVAL_MS);
  }

  private async registerSelf() {
    const code = this.config.get<string>('node.id')!;
    await this.prisma.node.upsert({
      where: { code },
      create: {
        code,
        name: this.config.get<string>('node.name')!,
        city: this.config.get<string>('node.city')!,
        state: this.config.get<string>('node.state')!,
        status: NodeStatus.ONLINE,
        lastHeartbeat: new Date(),
      },
      update: {
        status: NodeStatus.ONLINE,
        lastHeartbeat: new Date(),
      },
    });
    this.logger.log(`Nó ${code} registrado/online`);
  }

  private async heartbeat() {
    const code = this.config.get<string>('node.id')!;
    await this.prisma.node.update({
      where: { code },
      data: { status: NodeStatus.ONLINE, lastHeartbeat: new Date() },
    });
  }

  async findAll() {
    const [nodes, pendingCounts] = await Promise.all([
      this.prisma.node.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.syncEvent.groupBy({
        by: ['originNode'],
        where: { status: { in: [SyncEventStatus.PENDING, SyncEventStatus.FAILED] } },
        _count: { _all: true },
      }),
    ]);

    const pendingByNode = new Map(pendingCounts.map((p) => [p.originNode, p._count._all]));
    const now = Date.now();

    return nodes.map((node) => {
      const lastHeartbeatMs = node.lastHeartbeat?.getTime() ?? 0;
      const isStale = now - lastHeartbeatMs > OFFLINE_THRESHOLD_MS;
      return {
        ...node,
        status: isStale ? NodeStatus.OFFLINE : node.status,
        pendingEvents: pendingByNode.get(node.code) ?? 0,
      };
    });
  }

  async findByCode(code: string) {
    return this.prisma.node.findUnique({ where: { code } });
  }
}
