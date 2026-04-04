import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Categories() {
  const { data: categories, isLoading } = useCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const openNew = () => { setEditId(null); setName(''); setType('EXPENSE'); setDialogOpen(true); };
  const openEdit = (cat: { id: string; name: string; type: 'INCOME' | 'EXPENSE' }) => {
    setEditId(cat.id); setName(cat.name); setType(cat.type); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    try {
      if (editId) {
        await updateCat.mutateAsync({ id: editId, name: name.trim(), type });
        toast.success('Category updated');
      } else {
        await createCat.mutateAsync({ name: name.trim(), type });
        toast.success('Category created');
      }
      setDialogOpen(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCat.mutateAsync(id);
      toast.success('Category deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  const incomeCategories = categories?.filter((c) => c.type === 'INCOME') ?? [];
  const expenseCategories = categories?.filter((c) => c.type === 'EXPENSE') ?? [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button onClick={openNew} size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Category</Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-income flex items-center gap-2"><Tag className="w-4 h-4" />Income ({incomeCategories.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {incomeCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors group">
                  <span className="text-sm">{c.name}</span>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c as any)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
              {incomeCategories.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No income categories</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-expense flex items-center gap-2"><Tag className="w-4 h-4" />Expense ({expenseCategories.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {expenseCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors group">
                  <span className="text-sm">{c.name}</span>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c as any)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
              {expenseCategories.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No expense categories</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'New'} Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createCat.isPending || updateCat.isPending}>
              {editId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
