import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Plus, 
  BookOpen, 
  Loader2, 
  Eye,
  FileText,
  AlertTriangle,
  Settings,
  BookMarked,
  Lightbulb,
  Wrench
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Streamdown } from "streamdown";

export default function Knowledge() {
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [systemFilter, setSystemFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKnowledge, setSelectedKnowledge] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newSystemType, setNewSystemType] = useState<string>("");
  const [newTags, setNewTags] = useState("");

  const { data: knowledgeList, isLoading, refetch } = trpc.knowledge.list.useQuery({
    category: categoryFilter as any || undefined,
    systemType: systemFilter as any || undefined,
    search: searchQuery || undefined,
    limit: 50
  });

  const { data: knowledgeDetail } = trpc.knowledge.getById.useQuery(
    { id: selectedKnowledge! },
    { enabled: !!selectedKnowledge }
  );

  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      toast.success("知识创建成功");
      setIsCreateOpen(false);
      setNewTitle("");
      setNewContent("");
      setNewCategory("");
      setNewSystemType("");
      setNewTags("");
      refetch();
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    }
  });

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      equipment_manual: <FileText className="h-5 w-5" />,
      fault_case: <AlertTriangle className="h-5 w-5" />,
      process_spec: <Settings className="h-5 w-5" />,
      operation_guide: <BookMarked className="h-5 w-5" />,
      troubleshooting: <Wrench className="h-5 w-5" />,
      best_practice: <Lightbulb className="h-5 w-5" />
    };
    return icons[category] || <BookOpen className="h-5 w-5" />;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      equipment_manual: "设备手册",
      fault_case: "故障案例",
      process_spec: "工艺规范",
      operation_guide: "操作指南",
      troubleshooting: "故障排除",
      best_practice: "最佳实践"
    };
    return labels[category] || category;
  };

  const getSystemLabel = (system: string) => {
    const labels: Record<string, string> = {
      erp: "ERP系统",
      mes: "MES系统",
      plm: "PLM系统",
      scada: "SCADA系统",
      oa: "OA系统",
      iam: "IAM系统",
      hr: "HR系统",
      general: "通用"
    };
    return labels[system] || system;
  };

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim() || !newCategory) {
      toast.error("请填写必填字段");
      return;
    }
    createMutation.mutate({
      title: newTitle,
      content: newContent,
      category: newCategory as any,
      systemType: newSystemType as any || undefined,
      tags: newTags ? newTags.split(",").map(t => t.trim()) : undefined
    });
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">知识库</h1>
          <p className="text-muted-foreground">设备手册、故障案例、工艺规范等知识文档</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新建知识
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>创建知识文档</DialogTitle>
              <DialogDescription>
                添加设备手册、故障案例、操作指南等知识文档
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">标题 *</Label>
                <Input
                  id="title"
                  placeholder="知识文档标题"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>知识类别 *</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择类别" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipment_manual">设备手册</SelectItem>
                      <SelectItem value="fault_case">故障案例</SelectItem>
                      <SelectItem value="process_spec">工艺规范</SelectItem>
                      <SelectItem value="operation_guide">操作指南</SelectItem>
                      <SelectItem value="troubleshooting">故障排除</SelectItem>
                      <SelectItem value="best_practice">最佳实践</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>关联系统</Label>
                  <Select value={newSystemType} onValueChange={setNewSystemType}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择系统" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">通用</SelectItem>
                      <SelectItem value="erp">ERP系统</SelectItem>
                      <SelectItem value="mes">MES系统</SelectItem>
                      <SelectItem value="plm">PLM系统</SelectItem>
                      <SelectItem value="scada">SCADA系统</SelectItem>
                      <SelectItem value="oa">OA系统</SelectItem>
                      <SelectItem value="iam">IAM系统</SelectItem>
                      <SelectItem value="hr">HR系统</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">内容 *</Label>
                <Textarea
                  id="content"
                  placeholder="知识文档内容，支持Markdown格式"
                  rows={10}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">标签（逗号分隔）</Label>
                <Input
                  id="tags"
                  placeholder="如：CNC, 故障, 维护"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索知识..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="知识类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类别</SelectItem>
                <SelectItem value="equipment_manual">设备手册</SelectItem>
                <SelectItem value="fault_case">故障案例</SelectItem>
                <SelectItem value="process_spec">工艺规范</SelectItem>
                <SelectItem value="operation_guide">操作指南</SelectItem>
                <SelectItem value="troubleshooting">故障排除</SelectItem>
                <SelectItem value="best_practice">最佳实践</SelectItem>
              </SelectContent>
            </Select>
            <Select value={systemFilter} onValueChange={setSystemFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="关联系统" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部系统</SelectItem>
                <SelectItem value="general">通用</SelectItem>
                <SelectItem value="erp">ERP系统</SelectItem>
                <SelectItem value="mes">MES系统</SelectItem>
                <SelectItem value="plm">PLM系统</SelectItem>
                <SelectItem value="scada">SCADA系统</SelectItem>
                <SelectItem value="oa">OA系统</SelectItem>
                <SelectItem value="iam">IAM系统</SelectItem>
                <SelectItem value="hr">HR系统</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 知识列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : knowledgeList?.items && knowledgeList.items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {knowledgeList.items.map((doc) => (
            <Card 
              key={doc.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedKnowledge(doc.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    {getCategoryIcon(doc.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base line-clamp-1">{doc.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {getCategoryLabel(doc.category)} · {getSystemLabel(doc.systemType)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {doc.content.slice(0, 100)}...
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{doc.viewCount} 次浏览</span>
                  </div>
                  <span>{format(new Date(doc.createdAt), "yyyy-MM-dd")}</span>
                </div>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {doc.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {doc.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{doc.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>暂无知识文档</p>
              <p className="text-sm mt-1">点击"新建知识"添加文档</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 知识详情弹窗 */}
      <Dialog open={!!selectedKnowledge} onOpenChange={() => setSelectedKnowledge(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {knowledgeDetail && (
                <>
                  <div className="p-2 rounded-lg bg-muted">
                    {getCategoryIcon(knowledgeDetail.category)}
                  </div>
                  {knowledgeDetail.title}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {knowledgeDetail && (
                <span>
                  {getCategoryLabel(knowledgeDetail.category)} · {getSystemLabel(knowledgeDetail.systemType)} · 
                  {knowledgeDetail.viewCount} 次浏览
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {knowledgeDetail && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* 标签 */}
                {knowledgeDetail.tags && knowledgeDetail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {knowledgeDetail.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* 内容 */}
                <div className="prose prose-sm max-w-none">
                  <Streamdown>{knowledgeDetail.content}</Streamdown>
                </div>

                {/* 元信息 */}
                <div className="pt-4 border-t text-sm text-muted-foreground">
                  <p>创建时间：{format(new Date(knowledgeDetail.createdAt), "yyyy-MM-dd HH:mm:ss")}</p>
                  <p>更新时间：{format(new Date(knowledgeDetail.updatedAt), "yyyy-MM-dd HH:mm:ss")}</p>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
