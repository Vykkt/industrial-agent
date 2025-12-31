import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Ticket, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Wrench, 
  TrendingUp,
  MessageSquare,
  ArrowRight,
  Loader2,
  Bot
} from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: ticketStats, isLoading: ticketLoading } = trpc.ticket.stats.useQuery();
  const { data: toolStats, isLoading: toolLoading } = trpc.tool.stats.useQuery();
  const { data: recentTickets } = trpc.ticket.list.useQuery({ limit: 5 });

  const stats = [
    {
      title: "总工单数",
      value: ticketStats?.total || 0,
      icon: Ticket,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "已解决",
      value: ticketStats?.resolved || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "解决率",
      value: `${(ticketStats?.resolveRate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "平均响应",
      value: ticketStats?.avgResponseTime 
        ? `${Math.round(ticketStats.avgResponseTime / 60)}分钟` 
        : "N/A",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100"
    }
  ];

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      erp_finance: "ERP财务",
      erp_inventory: "ERP库存",
      mes_production: "MES生产",
      mes_quality: "MES质量",
      plm_design: "PLM设计",
      plm_bom: "PLM BOM",
      scada_alarm: "SCADA报警",
      scada_data: "SCADA数据",
      oa_workflow: "OA流程",
      iam_permission: "IAM权限",
      hr_attendance: "HR考勤",
      other: "其他"
    };
    return labels[category] || category;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "待处理",
      processing: "处理中",
      waiting_feedback: "待反馈",
      resolved: "已解决",
      closed: "已关闭",
      failed: "处理失败"
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      urgent: "紧急",
      high: "高",
      medium: "中",
      low: "低"
    };
    return labels[priority] || priority;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-muted-foreground">工业智能运维Agent系统概览</p>
        </div>
        <Button onClick={() => setLocation("/chat")} className="gap-2">
          <MessageSquare className="h-4 w-4" />
          新建对话
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">
                    {ticketLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stat.value}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 最近工单 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>最近工单</CardTitle>
              <CardDescription>最新提交的问题工单</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/tickets")}>
              查看全部 <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentTickets?.tickets && recentTickets.tickets.length > 0 ? (
              <div className="space-y-3">
                {recentTickets.tickets.map((ticket) => (
                  <div 
                    key={ticket.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => setLocation(`/tickets/${ticket.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ticket.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`status-badge status-${ticket.status}`}>
                          {getStatusLabel(ticket.status)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getCategoryLabel(ticket.category)}
                        </span>
                      </div>
                    </div>
                    <span className={`status-badge priority-${ticket.priority}`}>
                      {getPriorityLabel(ticket.priority)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无工单</p>
                <Button variant="link" onClick={() => setLocation("/chat")}>
                  创建第一个工单
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 工具使用统计 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>工具统计</CardTitle>
              <CardDescription>工业软件API工具使用情况</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/tools")}>
              管理工具 <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {toolLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : toolStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{toolStats.totalTools}</p>
                    <p className="text-xs text-muted-foreground">可用工具</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{toolStats.totalUsage}</p>
                    <p className="text-xs text-muted-foreground">总调用次数</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{toolStats.avgSuccessRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">平均成功率</p>
                  </div>
                </div>
                
                {toolStats.topTools && toolStats.topTools.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">热门工具</p>
                    <div className="space-y-2">
                      {toolStats.topTools.slice(0, 5).map((tool) => (
                        <div key={tool.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{tool.displayName}</span>
                          <span className="text-muted-foreground">{tool.usageCount}次</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无工具数据</p>
                <Button variant="link" onClick={() => setLocation("/tools")}>
                  初始化工具
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>常用功能入口</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => setLocation("/chat")}
            >
              <Bot className="h-6 w-6" />
              <span>智能问答</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => setLocation("/tickets")}
            >
              <Ticket className="h-6 w-6" />
              <span>提交工单</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => setLocation("/knowledge")}
            >
              <AlertTriangle className="h-6 w-6" />
              <span>故障查询</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => setLocation("/analytics")}
            >
              <TrendingUp className="h-6 w-6" />
              <span>数据分析</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
