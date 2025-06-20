import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Plus, Search, Edit, Trash2, Mail, Phone,
  CheckCircle, XCircle, Clock, UserPlus
} from 'lucide-react';
import { insertGuestSchema, type Guest, type InsertGuest } from '@shared/schema';
import { z } from 'zod';

interface GuestListManagerProps {
  weddingId: number;
  className?: string;
}

const guestSchema = insertGuestSchema.omit({ id: true, weddingId: true, createdAt: true, respondedAt: true });
type GuestFormData = z.infer<typeof guestSchema>;

export function GuestListManager({ weddingId, className = '' }: GuestListManagerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  const form = useForm<GuestFormData>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      rsvpStatus: 'pending',
      plusOne: false,
      plusOneName: '',
      additionalGuests: 0,
      category: 'family',
      side: 'both',
      dietaryRestrictions: '',
      address: '',
      notes: '',
    },
  });

  // Fetch guests using the correct endpoint
  const { data: guests = [], isLoading } = useQuery<Guest[]>({
    queryKey: ['/api/guests/wedding', weddingId],
    enabled: !!weddingId,
  });

  // Add guest mutation
  const addGuestMutation = useMutation({
    mutationFn: (data: GuestFormData) => {
      const guestData: InsertGuest = {
        ...data,
        weddingId,
        email: data.email || null,
        phone: data.phone || null,
        plusOneName: data.plusOneName || null,
        dietaryRestrictions: data.dietaryRestrictions || null,
        address: data.address || null,
        notes: data.notes || null,
      };
      return apiRequest('/api/guests', {
        method: 'POST',
        body: JSON.stringify(guestData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guests/wedding', weddingId] });
      setIsAddDialogOpen(false);
      setEditingGuest(null);
      form.reset();
      toast({
        title: t('guestList.guestAdded'),
        description: t('guestList.guestAddedSuccess'),
      });
    },
  });

  // Update guest mutation
  const updateGuestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Guest> }) => apiRequest(`/api/guests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guests/wedding', weddingId] });
      toast({
        title: t('guestList.guestUpdated'),
        description: t('guestList.guestUpdatedSuccess'),
      });
    },
  });

  // Delete guest mutation
  const deleteGuestMutation = useMutation({
    mutationFn: (guestId: number) => apiRequest(`/api/guests/${guestId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guests/wedding', weddingId] });
      toast({
        title: t('guestList.guestDeleted'),
        description: t('guestList.guestDeletedSuccess'),
      });
    },
  });

  const onSubmit = (data: GuestFormData) => {
    if (editingGuest) {
      updateGuestMutation.mutate({ id: editingGuest.id, data });
    } else {
      addGuestMutation.mutate(data);
    }
  };

  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest);
    form.reset({
      name: guest.name,
      email: guest.email || '',
      phone: guest.phone || '',
      rsvpStatus: guest.rsvpStatus,
      plusOne: guest.plusOne,
      plusOneName: guest.plusOneName || '',
      additionalGuests: guest.additionalGuests,
      category: guest.category,
      side: guest.side,
      dietaryRestrictions: guest.dietaryRestrictions || '',
      address: guest.address || '',
      notes: guest.notes || '',
    });
    setIsAddDialogOpen(true);
  };

  const handleStatusUpdate = (guestId: number, status: Guest['rsvpStatus']) => {
    updateGuestMutation.mutate({ 
      id: guestId, 
      data: { 
        rsvpStatus: status,
        respondedAt: new Date(),
      }
    });
  };

  // Filter guests
  const filteredGuests = guests.filter((guest: Guest) => {
    const matchesSearch = guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guest.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guest.phone?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || guest.rsvpStatus === statusFilter;
    const matchesCategory = categoryFilter === 'all' || guest.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Statistics
  const stats = {
    total: guests.length,
    confirmed: guests.filter((g: Guest) => g.rsvpStatus === 'confirmed').length,
    declined: guests.filter((g: Guest) => g.rsvpStatus === 'declined').length,
    pending: guests.filter((g: Guest) => g.rsvpStatus === 'pending').length,
    maybe: guests.filter((g: Guest) => g.rsvpStatus === 'maybe').length,
  };

  const getStatusBadge = (status: Guest['rsvpStatus']) => {
    const variants = {
      confirmed: 'default',
      declined: 'destructive',
      pending: 'secondary',
      maybe: 'outline',
    } as const;

    const labels = {
      confirmed: t('guestList.confirmed'),
      declined: t('guestList.declined'),
      pending: t('guestList.pending'),
      maybe: t('guestList.maybe'),
    };

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getStatusIcon = (status: Guest['rsvpStatus']) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'declined': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4B08C] mx-auto mb-4"></div>
        <p className="text-[#2C3338]/70">Loading guests...</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('guestList.totalGuests')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              {t('guestList.confirmed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              {t('guestList.declined')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              {t('guestList.pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              {t('guestList.maybe')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.maybe}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('guestList.searchGuests')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder={t('guestList.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('guestList.allStatuses')}</SelectItem>
            <SelectItem value="confirmed">{t('guestList.confirmed')}</SelectItem>
            <SelectItem value="declined">{t('guestList.declined')}</SelectItem>
            <SelectItem value="pending">{t('guestList.pending')}</SelectItem>
            <SelectItem value="maybe">{t('guestList.maybe')}</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder={t('guestList.filterByCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('guestList.allCategories')}</SelectItem>
            <SelectItem value="family">{t('guestList.family')}</SelectItem>
            <SelectItem value="friends">{t('guestList.friends')}</SelectItem>
            <SelectItem value="colleagues">{t('guestList.colleagues')}</SelectItem>
            <SelectItem value="other">{t('guestList.other')}</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="wedding-button">
              <Plus className="h-4 w-4 mr-2" />
              {t('guestList.addGuest')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingGuest ? t('guestList.editGuest') : t('guestList.addNewGuest')}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('guestList.guestName')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('guestList.enterGuestName')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('guestList.email')}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={t('guestList.enterEmail')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('guestList.phone')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('guestList.enterPhone')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('guestList.category')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('guestList.selectCategory')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="family">{t('guestList.family')}</SelectItem>
                            <SelectItem value="friends">{t('guestList.friends')}</SelectItem>
                            <SelectItem value="colleagues">{t('guestList.colleagues')}</SelectItem>
                            <SelectItem value="other">{t('guestList.other')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingGuest(null);
                      form.reset();
                    }}
                    className="flex-1"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={addGuestMutation.isPending || updateGuestMutation.isPending}
                    className="wedding-button flex-1"
                  >
                    {(addGuestMutation.isPending || updateGuestMutation.isPending) 
                      ? t('common.saving') 
                      : editingGuest 
                        ? t('common.save') 
                        : t('guestList.addGuest')
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Guest List */}
      <div className="space-y-4">
        {filteredGuests.map((guest) => (
          <Card key={guest.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(guest.rsvpStatus)}
                  <div>
                    <div className="font-medium">{guest.name}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-4">
                      {guest.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {guest.email}
                        </span>
                      )}
                      {guest.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {guest.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {guest.plusOne && (
                  <Badge variant="outline">+1</Badge>
                )}
                {getStatusBadge(guest.rsvpStatus)}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEdit(guest)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredGuests.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
            ? t('guestList.noGuestsFound') 
            : t('guestList.noGuestsYet')
          }
        </div>
      )}
    </div>
  );
}