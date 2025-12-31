import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Filter, 
  Eye, 
  MessageSquare,
  Loader2,
  Ticket,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Streamdown } from "streamdown";

export default function Tickets() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);

  const { data: ticketsData, isLoading } = trpc.ticket.list.useQuery({
    status: statusFilter as any || undefined,
    category: categoryFilter as any || undefined,
    priority: priorityFilter as any || undefined,
    limit: 50
  });

  const { data: ticketDetail } = trpc.ticket.getById.useQuery(
    { id: selectedTicket! },
    { enabled: !!selectedTicket }
  );

  const { data: ticketMessages } = trpc.ticket.getMessages.useQuery(
    { ticketId: selectedTicket! },
    { enabled: !!selectedTicket }
  );

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "waiting_feedback":
        return <AlertCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const filteredTickets = ticketsData?.tickets?.filter(ticket => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.title.toLowerCase().includes(query) ||
      ticket.ticketNo.toLowerCase().includes(query) ||
      ticket.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">工单管理</h1>
          <p className="text-muted-foreground">查看和管理所有问题工单</p>
        </div>
        <Button onClick={() => setLocation("/chat")}>
          <MessageSquare className="mr-2 h-4 w-4" />
          新建工单
        </Button>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索工单..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="waiting_feedback">待反馈</SelectItem>
                <SelectItem value="resolved">已解决</SelectItem>
                <SelectItem value="closed">已关闭</SelectItem>
                <SelectItem value="failed">处理失败</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类别</SelectItem>
                <SelectItem value="erp_finance">ERP财务</SelectItem>
                <SelectItem value="erp_inventory">ERP库存</SelectItem>
                <SelectItem value="mes_production">MES生产</SelectItem>
                <SelectItem value="mes_quality">MES质量</SelectItem>
                <SelectItem value="plm_design">PLM设计</SelectItem>
                <SelectItem value="scada_alarm">SCADA报警</SelectItem>
                <SelectItem value="oa_workflow">OA流程</SelectItem>
                <SelectItem value="iam_permission">IAM权限</SelectItem>
                <SelectItem value="hr_attendance">HR考勤</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="优先级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部优先级</SelectItem>
                <SelectItem value="urgent">紧急</SelectItem>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 工单列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            工单列表
            {ticketsData && (
              <Badge variant="secondary" className="ml-2">
                {ticketsData.total} 条
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets && filteredTickets.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">工单号</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead className="w-[100px]">类别</TableHead>
                    <TableHead className="w-[80px]">优先级</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[150px]">创建时间</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">
                        {ticket.ticketNo}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px] truncate" title={ticket.title}>
                          {ticket.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`category-${ticket.category.split('_')[0]}`}>
                          {getCategoryLabel(ticket.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`priority-${ticket.priority}`}>
                          {getPriorityLabel(ticket.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(ticket.status)}
                          <span className="text-sm">{getStatusLabel(ticket.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ticket.createdAt), "MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(`/chat?ticket=${ticket.id}`)}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>暂无工单数据</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 工单详情弹窗 */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {ticketDetail && getStatusIcon(ticketDetail.status)}
              {ticketDetail?.title}
            </DialogTitle>
            <DialogDescription>
              {ticketDetail?.ticketNo} · {ticketDetail && getCategoryLabel(ticketDetail.category)}
            </DialogDescription>
          </DialogHeader>
          
          {ticketDetail && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">状态：</span>
                    <span className="ml-2">{getStatusLabel(ticketDetail.status)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">优先级：</span>
                    <Badge className={`ml-2 priority-${ticketDetail.priority}`}>
                      {getPriorityLabel(ticketDetail.priority)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">创建时间：</span>
                    <span className="ml-2">
                      {format(new Date(ticketDetail.createdAt), "yyyy-MM-dd HH:mm:ss")}
                    </span>
                  </div>
                  {ticketDetail.resolvedAt && (
                    <div>
                      <span className="text-muted-foreground">解决时间：</span>
                      <span className="ml-2">
                        {format(new Date(ticketDetail.resolvedAt), "yyyy-MM-dd HH:mm:ss")}
                      </span>
                    </div>
                  )}
                </div>

                {/* 问题描述 */}
                <div>
                  <h4 className="font-medium mb-2">问题描述</h4>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {ticketDetail.description}
                  </div>
                </div>

                {/* 使用的工具 */}
                {ticketDetail.toolsUsed && ticketDetail.toolsUsed.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">使用的工具</h4>
                    <div className="flex flex-wrap gap-2">
                      {ticketDetail.toolsUsed.map((tool, index) => (
                        <Badge key={index} variant="secondary">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent总结 */}
                {ticketDetail.agentSummary && (
                  <div>
                    <h4 className="font-medium mb-2">Agent分析总结</h4>
                    <div className="p-3 bg-blue-50 rounded-lg text-sm">
                      <Streamdown>{ticketDetail.agentSummary}</Streamdown>
                    </div>
                  </div>
                )}

                {/* 对话记录 */}
                {ticketMessages && ticketMessages.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">对话记录</h4>
                    <div className="space-y-3">
                      {ticketMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg text-sm ${
                            msg.role === "user"
                              ? "bg-primary/10 ml-8"
                              : "bg-muted mr-8"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {msg.role === "user" ? "用户" : "Agent"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.createdAt), "HH:mm:ss")}
                            </span>
                          </div>
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
