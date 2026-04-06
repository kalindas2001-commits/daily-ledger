import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, StickyNote } from 'lucide-react';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/useNotes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function DailyNotes() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: notes } = useNotes(monthStart, monthEnd);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const notesByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    notes?.forEach(n => {
      if (!map[n.note_date]) map[n.note_date] = [];
      map[n.note_date].push(n);
    });
    return map;
  }, [notes]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const blanks = ((getDay(startOfMonth(currentMonth)) || 7) - 1);

  const selectedNotes = selectedDate ? (notesByDate[selectedDate] ?? []) : [];

  const handleAdd = () => {
    if (!selectedDate) return;
    setEditId(null);
    setNoteText('');
    setAddOpen(true);
  };

  const handleEdit = (note: any) => {
    setEditId(note.id);
    setNoteText(note.note);
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!noteText.trim()) { toast.error('Enter a note'); return; }
    try {
      if (editId) {
        await updateNote.mutateAsync({ id: editId, note: noteText.trim() });
        toast.success('Note updated');
      } else {
        await createNote.mutateAsync({ note_date: selectedDate!, note: noteText.trim() });
        toast.success('Note added');
      }
      setAddOpen(false);
      setNoteText('');
      setEditId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteNote.mutateAsync(id); toast.success('Note deleted'); }
    catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: blanks }).map((_, i) => <div key={`b-${i}`} />)}
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasNotes = !!notesByDate[dateStr];
              const isSelected = selectedDate === dateStr;
              return (
                <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'relative p-2 rounded-lg text-left transition-colors min-h-[48px] hover:bg-muted',
                    isToday(day) && 'ring-2 ring-primary',
                    isSelected && 'bg-primary/10',
                    hasNotes && !isSelected && 'bg-accent/10'
                  )}>
                  <span className={cn('text-xs font-medium', isToday(day) && 'text-primary')}>{format(day, 'd')}</span>
                  {hasNotes && (
                    <StickyNote className="absolute bottom-1 right-1 w-3 h-3 text-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day notes */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</CardTitle>
              <Button size="sm" variant="outline" onClick={handleAdd}>
                <Plus className="w-4 h-4 mr-1" /> Add Note
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedNotes.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">No notes for this day</p>
            ) : selectedNotes.map(n => (
              <div key={n.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), 'h:mm a')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(n)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(n.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Note Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Note' : 'Add Note'}</DialogTitle></DialogHeader>
          <Textarea placeholder="What happened today?" value={noteText} onChange={e => setNoteText(e.target.value)} className="min-h-[120px]" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createNote.isPending || updateNote.isPending}>
              {editId ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
