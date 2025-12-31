import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Wrench, 
  Loader2, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Info,
  Database,
  Factory,
  FileText,
  Monitor,
  FileCheck,
  Shield,
  Users,
  BookOpen
} from "lucide-react";
import { toast } from "sonner";

export default function Tools() {
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<number | null>(null);

  const { data: tools, isLoading, refetch } = trpc.tool.list.useQuery({
    category: categoryFilter as any || undefined
  });

  const { data: toolDetail } = trpc.tool.getById.useQuery(
    { id: selectedTool! },
    { enabled: !!selectedTool }
  );

  const { data: toolStats } = trpc.tool.stats.useQuery();

  const initPresetMutation = trpc.tool.initPreset.useMutation({
    onSuccess: (result) => {
      const created = result.results.filter(r => r.status === "created").length;
      toast.success(`初始化完成：新增 ${created} 个工具`);
      refetch();
    },
    onError: (error) => {
      toast.error(`初始化失败: ${error.message}`);
    }
  });

  const updateToolMutation = trpc.tool.update.useMutation({
    onSuccess: () => {
      toast.success("工具更新成功");
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    }
  });

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      erp: <Database className="h-5 w-5" />,
      mes: <Factory className="h-5 w-5" />,
      plm: <FileText className="h-5 w-5" />,
      scada: <Monitor className="h-5 w-5" />,
      oa: <FileCheck className="h-5 w-5" />,
      iam: <Shield className="h-5 w-5" />,
      hr: <Users className="h-5 w-5" />,
      knowledge: <BookOpen className="h-5 w-5" />
    };
    return icons[category] || <Wrench className="h-5 w-5" />;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      erp: "ERP系统",
      mes: "MES系统",
      plm: "PLM系统",
      scada: "SCADA系统",
      oa: "OA系统",
      iam: "IAM系统",
      hr: "HR系统",
      knowledge: "知识库"
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      erp: "bg-indigo-100 text-indigo-800 border-indigo-200",
      mes: "bg-emerald-100 text-emerald-800 border-emerald-200",
      plm: "bg-purple-100 text-purple-800 border-purple-200",
      scada: "bg-cyan-100 text-cyan-800 border-cyan-200",
      oa: "bg-pink-100 text-pink-800 border-pink-200",
      iam: "bg-orange-100 text-orange-800 border-orange-200",
      hr: "bg-teal-100 text-teal-800 border-teal-200",
      knowledge: "bg-slate-100 text-slate-800 border-slate-200"
    };
    return colors[category] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const filteredTools = tools?.filter(tool => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(query) ||
      tool.displayName.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  });

  const handleToggleEnabled = (toolId: number, currentEnabled: boolean) => {
    updateToolMutation.mutate({
      id: toolId,
      isEnabled: !currentEnabled
    });
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">工具管理</h1>
          <p className="text-muted-foreground">管理工业软件API工具</p>
        </div>
        <Button 
          onClick={() => initPresetMutation.mutate()}
          disabled={initPresetMutation.isPending}
        >
          {initPresetMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          初始化预置工具
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总工具数</p>
                <p className="text-2xl font-bold">{toolStats?.totalTools || 0}</p>
              </div>
              <Wrench className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已启用</p>
                <p className="text-2xl font-bold">{tools?.filter(t => t.isEnabled).length || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总调用次数</p>
                <p className="text-2xl font-bold">{toolStats?.totalUsage || 0}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均成功率</p>
                <p className="text-2xl font-bold">
                  {(toolStats?.avgSuccessRate || 0).toFixed(1)}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索工具..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="全部类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类别</SelectItem>
                <SelectItem value="erp">ERP系统</SelectItem>
                <SelectItem value="mes">MES系统</SelectItem>
                <SelectItem value="plm">PLM系统</SelectItem>
                <SelectItem value="scada">SCADA系统</SelectItem>
                <SelectItem value="oa">OA系统</SelectItem>
                <SelectItem value="iam">IAM系统</SelectItem>
                <SelectItem value="hr">HR系统</SelectItem>
                <SelectItem value="knowledge">知识库</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 工具列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTools && filteredTools.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <Card 
              key={tool.id} 
              className={`tool-card cursor-pointer ${!tool.isEnabled ? "opacity-60" : ""}`}
              onClick={() => setSelectedTool(tool.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(tool.category)}`}>
                      {getCategoryIcon(tool.category)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{tool.displayName}</CardTitle>
                      <CardDescription className="text-xs font-mono">
                        {tool.name}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={tool.isEnabled}
                    onCheckedChange={() => handleToggleEnabled(tool.id, tool.isEnabled)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {tool.description}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <Badge variant="outline" className={getCategoryColor(tool.category)}>
                    {getCategoryLabel(tool.category)}
                  </Badge>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>调用 {tool.usageCount} 次</span>
                    <span>成功率 {(tool.successRate || 0).toFixed(0)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>暂无工具</p>
              <p className="text-sm mt-1">点击"初始化预置工具"添加工业软件API工具</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 工具详情弹窗 */}
      <Dialog open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {toolDetail && (
                <>
                  <div className={`p-2 rounded-lg ${getCategoryColor(toolDetail.category)}`}>
                    {getCategoryIcon(toolDetail.category)}
                  </div>
                  {toolDetail.displayName}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {toolDetail?.name}
            </DialogDescription>
          </DialogHeader>
          
          {toolDetail && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* 基本信息 */}
                <div>
                  <h4 className="font-medium mb-2">工具描述</h4>
                  <p className="text-sm text-muted-foreground">
                    {toolDetail.description}
                  </p>
                </div>

                {/* 状态信息 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{toolDetail.usageCount}</p>
                    <p className="text-xs text-muted-foreground">调用次数</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{(toolDetail.successRate || 0).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">成功率</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">N/A</p>
                    <p className="text-xs text-muted-foreground">平均耗时</p>
                  </div>
                </div>

                {/* 参数列表 */}
                <div>
                  <h4 className="font-medium mb-2">参数定义</h4>
                  <div className="space-y-2">
                    {toolDetail.parameters.map((param, index) => (
                      <div 
                        key={index}
                        className="p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm">{param.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {param.type}
                          </Badge>
                          {param.required && (
                            <Badge variant="destructive" className="text-xs">
                              必填
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {param.description}
                        </p>
                        {param.enum && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {param.enum.map((val, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {val}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 启用状态 */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {toolDetail.isEnabled ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {toolDetail.isEnabled ? "已启用" : "已禁用"}
                    </span>
                  </div>
                  <Switch
                    checked={toolDetail.isEnabled}
                    onCheckedChange={() => handleToggleEnabled(toolDetail.id, toolDetail.isEnabled)}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
