import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Send, 
  Plus, 
  Bot, 
  User, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string | null;
  createdAt: Date;
}

interface AgentStep {
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
}

export default function Chat() {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState<string>("");
  const [newTicketPriority, setNewTicketPriority] = useState<string>("");
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [showSteps, setShowSteps] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: tickets, refetch: refetchTickets } = trpc.ticket.list.useQuery({ 
    myTickets: true,
    limit: 20 
  });
  
  const { data: messages, refetch: refetchMessages } = trpc.ticket.getMessages.useQuery(
    { ticketId: selectedTicketId! },
    { enabled: !!selectedTicketId }
  );

  const createTicketMutation = trpc.ticket.create.useMutation({
    onSuccess: (ticket) => {
      setSelectedTicketId(ticket.id);
      setIsNewTicketOpen(false);
      setNewTicketTitle("");
      setNewTicketDescription("");
      setNewTicketCategory("");
      setNewTicketPriority("");
      refetchTickets();
      toast.success("工单创建成功");
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    }
  });

  const chatMutation = trpc.agent.chat.useMutation({
    onSuccess: (result) => {
      setAgentSteps(result.steps);
      refetchMessages();
      refetchTickets();
    },
    onError: (error) => {
      toast.error(`发送失败: ${error.message}`);
    }
  });

  const autoProcessMutation = trpc.agent.autoProcess.useMutation({
    onSuccess: (result) => {
      setAgentSteps(result.steps);
      refetchMessages();
      refetchTickets();
      toast.success("自动处理完成");
    },
    onError: (error) => {
      toast.error(`处理失败: ${error.message}`);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateTicket = () => {
    if (!newTicketTitle.trim() || !newTicketDescription.trim()) {
      toast.error("请填写问题标题和描述");
      return;
    }
    createTicketMutation.mutate({
      title: newTicketTitle,
      description: newTicketDescription,
      category: newTicketCategory as any || undefined,
      priority: newTicketPriority as any || undefined
    });
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !selectedTicketId) return;
    
    chatMutation.mutate({
      ticketId: selectedTicketId,
      message: inputMessage
    });
    setInputMessage("");
    setAgentSteps([]);
  };

  const handleAutoProcess = () => {
    if (!selectedTicketId) return;
    autoProcessMutation.mutate({ ticketId: selectedTicketId });
    setAgentSteps([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* 左侧工单列表 */}
      <Card className="w-80 flex flex-col shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">对话列表</CardTitle>
            <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  新建
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建新工单</DialogTitle>
                  <DialogDescription>
                    描述您遇到的问题，Agent将自动分析并提供解决方案
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">问题标题</Label>
                    <Input
                      id="title"
                      placeholder="简要描述问题"
                      value={newTicketTitle}
                      onChange={(e) => setNewTicketTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">问题描述</Label>
                    <Textarea
                      id="description"
                      placeholder="详细描述问题现象、发生时间、影响范围等"
                      rows={4}
                      value={newTicketDescription}
                      onChange={(e) => setNewTicketDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>问题类别（可选）</Label>
                      <Select value={newTicketCategory} onValueChange={setNewTicketCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="自动识别" />
                        </SelectTrigger>
                        <SelectContent>
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
                    </div>
                    <div className="space-y-2">
                      <Label>优先级（可选）</Label>
                      <Select value={newTicketPriority} onValueChange={setNewTicketPriority}>
                        <SelectTrigger>
                          <SelectValue placeholder="自动识别" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">紧急</SelectItem>
                          <SelectItem value="high">高</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="low">低</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>
                    取消
                  </Button>
                  <Button 
                    onClick={handleCreateTicket}
                    disabled={createTicketMutation.isPending}
                  >
                    {createTicketMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    创建工单
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="px-4 pb-4 space-y-2">
              {tickets?.tickets && tickets.tickets.length > 0 ? (
                tickets.tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedTicketId === ticket.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 hover:bg-muted"
                    }`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="flex items-start gap-2">
                      {getStatusIcon(ticket.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{ticket.title}</p>
                        <p className={`text-xs mt-1 ${
                          selectedTicketId === ticket.id 
                            ? "text-primary-foreground/70" 
                            : "text-muted-foreground"
                        }`}>
                          {getCategoryLabel(ticket.category)} · {ticket.ticketNo}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无对话</p>
                  <p className="text-xs mt-1">点击"新建"开始</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右侧对话区域 */}
      <Card className="flex-1 flex flex-col">
        {selectedTicketId ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {tickets?.tickets?.find(t => t.id === selectedTicketId)?.title || "对话"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tickets?.tickets?.find(t => t.id === selectedTicketId)?.ticketNo}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAutoProcess}
                  disabled={autoProcessMutation.isPending}
                >
                  {autoProcessMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="mr-2 h-4 w-4" />
                  )}
                  自动处理
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
              {/* 消息列表 */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role !== "user" && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] ${
                          msg.role === "user"
                            ? "chat-message-user"
                            : "chat-message-assistant"
                        }`}
                      >
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                      {msg.role === "user" && (
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {(chatMutation.isPending || autoProcessMutation.isPending) && (
                    <div className="flex gap-3 justify-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="chat-message-assistant">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Agent正在分析处理...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Agent推理步骤 */}
              {agentSteps.length > 0 && (
                <div className="border-t p-4 bg-muted/30">
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowSteps(!showSteps)}
                  >
                    <Wrench className="h-4 w-4" />
                    Agent推理过程 ({agentSteps.length}步)
                    {showSteps ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  
                  {showSteps && (
                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                      {agentSteps.map((step, index) => (
                        <div key={index} className="text-sm">
                          <div className="thinking-step">
                            <p className="font-medium text-blue-700">思考 {index + 1}</p>
                            <p className="text-muted-foreground">{step.thought}</p>
                          </div>
                          {step.action && (
                            <div className="thinking-step-action">
                              <p className="font-medium text-emerald-700">
                                调用工具: {step.action}
                              </p>
                              {step.actionInput && (
                                <pre className="text-xs mt-1 text-muted-foreground overflow-x-auto">
                                  {JSON.stringify(step.actionInput, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                          {step.observation && (
                            <div className="thinking-step-observation">
                              <p className="font-medium text-amber-700">观察结果</p>
                              <pre className="text-xs mt-1 text-muted-foreground overflow-x-auto max-h-32">
                                {step.observation.slice(0, 500)}
                                {step.observation.length > 500 && "..."}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 输入区域 */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="描述您的问题或追问..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || chatMutation.isPending}
                    className="shrink-0"
                  >
                    {chatMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">选择或创建对话</h3>
              <p className="text-sm text-muted-foreground mt-1">
                从左侧选择已有工单，或点击"新建"创建新工单
              </p>
              <Button className="mt-4" onClick={() => setIsNewTicketOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新建工单
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
