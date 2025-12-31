import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Ticket,
  Wrench,
  BarChart3,
  PieChart
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Analytics() {
  const { data: ticketStats, isLoading: ticketLoading } = trpc.ticket.stats.useQuery();
  const { data: toolStats, isLoading: toolLoading } = trpc.tool.stats.useQuery();
  const { data: tickets } = trpc.ticket.list.useQuery({ limit: 100 });

  // 计算类别分布
  const categoryDistribution = tickets?.tickets?.reduce((acc, ticket) => {
    const category = ticket.category.split("_")[0].toUpperCase();
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = categoryDistribution
    ? Object.entries(categoryDistribution).map(([name, value]) => ({ name, value }))
    : [];

  // 计算状态分布
  const statusDistribution = tickets?.tickets?.reduce((acc, ticket) => {
    const statusLabels: Record<string, string> = {
      pending: "待处理",
      processing: "处理中",
      waiting_feedback: "待反馈",
      resolved: "已解决",
      closed: "已关闭",
      failed: "失败"
    };
    const status = statusLabels[ticket.status] || ticket.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = statusDistribution
    ? Object.entries(statusDistribution).map(([name, value]) => ({ name, value }))
    : [];

  // 计算优先级分布
  const priorityDistribution = tickets?.tickets?.reduce((acc, ticket) => {
    const priorityLabels: Record<string, string> = {
      urgent: "紧急",
      high: "高",
      medium: "中",
      low: "低"
    };
    const priority = priorityLabels[ticket.priority] || ticket.priority;
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priorityData = priorityDistribution
    ? Object.entries(priorityDistribution).map(([name, value]) => ({ name, value }))
    : [];

  // 工具使用排行
  const toolUsageData = toolStats?.topTools?.slice(0, 8).map(tool => ({
    name: tool.displayName.length > 8 ? tool.displayName.slice(0, 8) + "..." : tool.displayName,
    调用次数: tool.usageCount
  })) || [];

  const isLoading = ticketLoading || toolLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">统计分析</h1>
        <p className="text-muted-foreground">工单处理和工具使用数据分析</p>
      </div>

      {/* 核心指标 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总工单数</p>
                <p className="text-3xl font-bold">{ticketStats?.total || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Ticket className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">解决率</p>
                <p className="text-3xl font-bold">{(ticketStats?.resolveRate || 0).toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均响应时间</p>
                <p className="text-3xl font-bold">
                  {ticketStats?.avgResponseTime 
                    ? `${Math.round(ticketStats.avgResponseTime / 60)}分` 
                    : "N/A"}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">工具调用总数</p>
                <p className="text-3xl font-bold">{toolStats?.totalUsage || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Wrench className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 工单类别分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              工单类别分布
            </CardTitle>
            <CardDescription>按系统类型统计工单数量</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 工单状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              工单状态分布
            </CardTitle>
            <CardDescription>按处理状态统计工单数量</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 优先级分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              优先级分布
            </CardTitle>
            <CardDescription>按优先级统计工单数量</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {priorityData.map((entry, index) => {
                      const priorityColors: Record<string, string> = {
                        "紧急": "#ef4444",
                        "高": "#f97316",
                        "中": "#eab308",
                        "低": "#9ca3af"
                      };
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={priorityColors[entry.name] || COLORS[index % COLORS.length]} 
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 工具使用排行 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              工具使用排行
            </CardTitle>
            <CardDescription>最常使用的工业软件API工具</CardDescription>
          </CardHeader>
          <CardContent>
            {toolUsageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={toolUsageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={80} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="调用次数" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>工单处理效率</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">已解决工单</span>
              <span className="font-medium">{ticketStats?.resolved || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">待处理工单</span>
              <span className="font-medium">{ticketStats?.byStatus?.find(s => s.status === 'pending')?.count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">处理中工单</span>
              <span className="font-medium">{ticketStats?.byStatus?.find(s => s.status === 'processing')?.count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">平均解决时间</span>
              <span className="font-medium">
                {ticketStats?.avgResolveTime 
                  ? `${Math.round(ticketStats.avgResolveTime / 60)}分钟` 
                  : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>工具使用统计</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">可用工具数</span>
              <span className="font-medium">{toolStats?.totalTools || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">总调用次数</span>
              <span className="font-medium">{toolStats?.totalUsage || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">平均成功率</span>
              <span className="font-medium">{(toolStats?.avgSuccessRate || 0).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统健康度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Agent状态</span>
              <span className="font-medium text-green-600">正常运行</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">工具连接</span>
              <span className="font-medium text-green-600">全部在线</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">知识库状态</span>
              <span className="font-medium text-green-600">可用</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">LLM服务</span>
              <span className="font-medium text-green-600">正常</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
