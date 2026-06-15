import React, { useState, useEffect, useMemo } from 'react';
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TablePagination,
    TextField,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Tooltip,
    InputAdornment,
    Stack,
    Alert,
    Snackbar,
    CircularProgress,
    Avatar,
    Modal,
    Backdrop,
    Fade,
    Chip,
    Card,
    CardContent,
    LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Search as SearchIcon,
    CloudOff as CloudOffIcon,
    CloudDownload as CloudDownloadIcon,
    PictureAsPdf as PdfIcon,
    Image as ImageIcon,
    Upload as UploadIcon,
    Inventory as InventoryIcon,
    Category as CategoryIcon,
    Description as DescriptionIcon,
    Storage as StorageIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Link as LinkIcon,
} from '@mui/icons-material';
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

// ==================== Типы данных ====================
interface Component {
    id?: number;
    name: string;
    marking: string;
    parameters: string;
    imageData?: string;
    storageCell: string;
    quantity: number;
    datasheetFileName?: string;
    datasheetUrl?: string;
    note: string;
}

// ==================== Работа с IndexedDB ====================
const DB_NAME = 'ComponentsDB';
const STORE_NAME = 'components';
const DATASHEET_STORE = 'datasheetFiles';
const DB_VERSION = 3;

let dbInstance: IDBPDatabase | null = null;

const initDB = async () => {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('name', 'name');
                store.createIndex('marking', 'marking');
            }

            if (!db.objectStoreNames.contains(DATASHEET_STORE)) {
                db.createObjectStore(DATASHEET_STORE);
            }
        },
    });

    return dbInstance;
};

const loadComponents = async (): Promise<Component[]> => {
    try {
        const db = await initDB();
        const components = await db.getAll(STORE_NAME);
        return components;
    } catch (error) {
        console.error('Error loading components:', error);
        return [];
    }
};

const saveComponent = async (component: Component): Promise<number> => {
    try {
        const db = await initDB();
        const cleanComponent = {
            name: component.name || '',
            marking: component.marking || '',
            parameters: component.parameters || '',
            storageCell: component.storageCell || '',
            quantity: component.quantity || 0,
            note: component.note || '',
            imageData: component.imageData || '',
            datasheetFileName: component.datasheetFileName || '',
            datasheetUrl: component.datasheetUrl || '',
        };

        if (component.id) {
            Object.assign(cleanComponent, { id: component.id });
        }

        const id = await db.put(STORE_NAME, cleanComponent);
        return id as number;
    } catch (error) {
        console.error('Error saving component:', error);
        throw error;
    }
};

const deleteComponent = async (id: number): Promise<void> => {
    try {
        const db = await initDB();
        await db.delete(STORE_NAME, id);
    } catch (error) {
        console.error('Error deleting component:', error);
        throw error;
    }
};

// Демо-данные
const seedDemoData = async () => {
    try {
        const db = await initDB();
        const count = await db.count(STORE_NAME);
        if (count > 0) return;

        const demoComponents = [
            {
                name: 'Резистор',
                marking: '100 Ом ±5%',
                parameters: '100 Ом, 0.25Вт, 5%',
                storageCell: 'A1',
                quantity: 150,
                datasheetFileName: 'vishay_mrs25.pdf',
                datasheetUrl: 'https://www.vishay.com/docs/28700/mrs25.pdf',
                note: 'SMD 0805, отличная стабильность',
            },
            {
                name: 'Конденсатор',
                marking: '10µF 25V',
                parameters: '10µF, 25V, X5R',
                storageCell: 'B2',
                quantity: 75,
                datasheetFileName: '',
                datasheetUrl: '',
                note: 'керамический, 0805',
            },
            {
                name: 'Транзистор',
                marking: 'BC547',
                parameters: 'NPN, 45V, 100mA',
                storageCell: 'C3',
                quantity: 30,
                datasheetFileName: 'bc546_d.pdf',
                datasheetUrl: 'https://www.onsemi.com/pdf/datasheet/bc546-d.pdf',
                note: 'TO-92, универсальный',
            },
            {
                name: 'Светодиод',
                marking: 'Красный 5мм',
                parameters: '2В, 20мА, 500мкд',
                storageCell: 'D4',
                quantity: 200,
                datasheetFileName: '',
                datasheetUrl: '',
                note: 'диффузный, яркий',
            },
            {
                name: 'Микроконтроллер',
                marking: 'ATmega328P',
                parameters: '16MHz, 32KB Flash',
                storageCell: 'E5',
                quantity: 8,
                datasheetFileName: 'ATmega328P_datasheet.pdf',
                datasheetUrl: 'https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061B.pdf',
                note: 'DIP-28, популярный чип',
            },
        ];

        for (const comp of demoComponents) {
            await saveComponent(comp as Component);
        }
    } catch (error) {
        console.error('Error seeding demo data:', error);
    }
};

// ==================== Основной компонент ====================
const App: React.FC = () => {
    const theme = useTheme();
    const [components, setComponents] = useState<Component[]>([]);
    const [filteredComponents, setFilteredComponents] = useState<Component[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [sortColumn, setSortColumn] = useState<keyof Component>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false,
        message: '',
        severity: 'info',
    });
    const [imageZoomOpen, setImageZoomOpen] = useState(false);
    const [zoomedImage, setZoomedImage] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingComponent, setEditingComponent] = useState<Component | null>(null);
    const [formData, setFormData] = useState<Partial<Component>>({
        name: '',
        marking: '',
        parameters: '',
        storageCell: '',
        quantity: 0,
        note: '',
    });

    useEffect(() => {
        const init = async () => {
            try {
                await initDB();
                await seedDemoData();
                await refreshComponents();
            } catch (error) {
                console.error('Initialization error:', error);
            } finally {
                setLoading(false);
            }
        };
        init();

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const refreshComponents = async () => {
        const data = await loadComponents();
        setComponents(data);
    };

    useEffect(() => {
        let filtered = [...components];
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (c) =>
                    c.name.toLowerCase().includes(lowerTerm) ||
                    c.marking.toLowerCase().includes(lowerTerm)
            );
        }
        filtered.sort((a, b) => {
            const aVal = a[sortColumn] ?? '';
            const bVal = b[sortColumn] ?? '';
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        setFilteredComponents(filtered);
        setPage(0);
    }, [components, searchTerm, sortColumn, sortDirection]);

    const handleSort = (column: keyof Component) => {
        if (sortColumn === column) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const openLocalDatasheet = async (fileName: string) => {
        try {
            const db = await initDB();
            const fileData = await db.get(DATASHEET_STORE, fileName);
            if (fileData && fileData.blob) {
                const url = URL.createObjectURL(fileData.blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error opening local datasheet:', error);
            return false;
        }
    };

    const downloadDatasheet = async (component: Component, url: string) => {
        if (!isOnline) {
            setSnackbar({ open: true, message: 'Нет подключения к интернету', severity: 'error' });
            return false;
        }

        try {
            setSnackbar({ open: true, message: 'Скачивание даташита...', severity: 'info' });
            const response = await fetch(url);
            if (!response.ok) throw new Error('Не удалось скачать файл');

            const blob = await response.blob();
            const fileName = `datasheet_${component.name}_${component.marking}.pdf`;

            const db = await initDB();
            await db.put(DATASHEET_STORE, { blob, url, downloadDate: new Date() }, fileName);

            const updated = { ...component, datasheetFileName: fileName, datasheetUrl: url };
            await saveComponent(updated);
            await refreshComponents();

            setSnackbar({ open: true, message: `Даташит успешно сохранён`, severity: 'success' });
            return true;
        } catch (error) {
            console.error('Error downloading datasheet:', error);
            setSnackbar({ open: true, message: 'Ошибка при скачивании даташита', severity: 'error' });
            return false;
        }
    };

    const uploadLocalDatasheet = async (component: Component, file: File) => {
        if (!file.name.endsWith('.pdf')) {
            setSnackbar({ open: true, message: 'Пожалуйста, выберите PDF файл', severity: 'error' });
            return;
        }

        try {
            const db = await initDB();
            await db.put(DATASHEET_STORE, { blob: file, fileName: file.name, uploadDate: new Date() }, file.name);

            const updated = { ...component, datasheetFileName: file.name, datasheetUrl: undefined };
            await saveComponent(updated);
            await refreshComponents();

            setSnackbar({ open: true, message: `Локальный даташит добавлен`, severity: 'success' });
        } catch (error) {
            console.error('Error uploading datasheet:', error);
            setSnackbar({ open: true, message: 'Ошибка при сохранении локального даташита', severity: 'error' });
        }
    };

    const handleSearchDatasheetOnline = (component: Component) => {
        if (!isOnline) {
            setSnackbar({ open: true, message: 'Нет подключения к интернету', severity: 'warning' });
            return;
        }
        const query = encodeURIComponent(`${component.name} ${component.marking} datasheet PDF`);
        const searchUrl = `https://www.google.com/search?q=${query}`;
        window.open(searchUrl, '_blank');
        setSnackbar({ open: true, message: 'Поиск открыт в новой вкладке', severity: 'info' });
    };

    const handleDatasheetClick = async (component: Component) => {
        if (component.datasheetFileName) {
            await openLocalDatasheet(component.datasheetFileName);
        } else if (component.datasheetUrl) {
            window.open(component.datasheetUrl, '_blank');
        } else {
            if (!isOnline) {
                setSnackbar({ open: true, message: 'Нет интернета', severity: 'warning' });
                return;
            }
            const confirm = window.confirm('Даташит не найден. Хотите найти его в интернете?');
            if (confirm) {
                handleSearchDatasheetOnline(component);
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Удалить компонент?')) {
            try {
                await deleteComponent(id);
                await refreshComponents();
                setSnackbar({ open: true, message: 'Компонент удалён', severity: 'success' });
            } catch (error) {
                setSnackbar({ open: true, message: 'Ошибка при удалении компонента', severity: 'error' });
            }
        }
    };

    const handleEdit = (component: Component) => {
        setEditingComponent(component);
        setFormData({ ...component });
        setModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingComponent(null);
        setFormData({
            name: '',
            marking: '',
            parameters: '',
            storageCell: '',
            quantity: 0,
            note: '',
            imageData: '',
            datasheetFileName: '',
            datasheetUrl: '',
        });
        setModalOpen(true);
    };

    const handleSaveForm = async () => {
        if (!formData.name || formData.name.trim() === '') {
            setSnackbar({ open: true, message: 'Введите наименование компонента', severity: 'error' });
            return;
        }

        if (!formData.marking || formData.marking.trim() === '') {
            setSnackbar({ open: true, message: 'Введите маркировку компонента', severity: 'error' });
            return;
        }

        try {
            const newComponent: Component = {
                name: formData.name.trim(),
                marking: formData.marking.trim(),
                parameters: formData.parameters || '',
                storageCell: formData.storageCell || '',
                quantity: Number(formData.quantity) || 0,
                note: formData.note || '',
                imageData: formData.imageData || '',
                datasheetFileName: formData.datasheetFileName || '',
                datasheetUrl: formData.datasheetUrl || '',
            };

            if (editingComponent?.id) {
                newComponent.id = editingComponent.id;
            }

            await saveComponent(newComponent);
            await refreshComponents();

            setModalOpen(false);
            setFormData({
                name: '',
                marking: '',
                parameters: '',
                storageCell: '',
                quantity: 0,
                note: '',
            });
            setEditingComponent(null);

            setSnackbar({
                open: true,
                message: editingComponent ? 'Компонент обновлён' : 'Компонент добавлен',
                severity: 'success'
            });
        } catch (error) {
            setSnackbar({
                open: true,
                message: `Ошибка при сохранении`,
                severity: 'error'
            });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData((prev) => ({ ...prev, imageData: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageClick = (imageSrc: string) => {
        setZoomedImage(imageSrc);
        setImageZoomOpen(true);
    };

    const paginatedComponents = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredComponents.slice(start, start + rowsPerPage);
    }, [filteredComponents, page, rowsPerPage]);

    const ImageThumbnail: React.FC<{ src?: string }> = ({ src }) => {
        if (!src) return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Нет фото</Typography>;
        return (
            <Avatar
                src={src}
                variant="rounded"
                sx={{
                    width: 50,
                    height: 50,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                        transform: 'scale(1.2)',
                        boxShadow: theme.shadows[4],
                    }
                }}
                onClick={() => handleImageClick(src)}
            />
        );
    };

    const getStockStatus = (quantity: number) => {
        if (quantity === 0) return { color: 'error', icon: <WarningIcon />, text: 'Нет в наличии' };
        if (quantity < 10) return { color: 'warning', icon: <WarningIcon />, text: 'Мало' };
        if (quantity < 50) return { color: 'info', icon: <InventoryIcon />, text: 'Средне' };
        return { color: 'success', icon: <CheckCircleIcon />, text: 'Много' };
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <CircularProgress sx={{ color: 'white' }} />
            </Box>
        );
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            py: 4,
        }}>
            <Container maxWidth="xl">
                {/* Заголовок */}
                <Card sx={{
                    mb: 4,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 3,
                }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                            <Box>
                                <Typography variant="h3" component="h1" sx={{
                                    fontWeight: 'bold',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    color: 'transparent',
                                    mb: 1,
                                }}>
                                    Электронные компоненты
                                </Typography>
                                <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
                                    Управление складом электронных компонентов
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    placeholder="Поиск по наименованию или маркировке..."
                                    variant="outlined"
                                    size="medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    sx={{
                                        width: 350,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 3,
                                            backgroundColor: 'white',
                                        }
                                    }}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ color: '#667eea' }} />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddNew}
                                    sx={{
                                        borderRadius: 3,
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: '0 6px 20px rgba(102,126,234,0.6)',
                                        },
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    Добавить компонент
                                </Button>
                            </Stack>
                        </Box>
                    </CardContent>
                </Card>

                {!isOnline && (
                    <Alert
                        icon={<CloudOffIcon />}
                        severity="warning"
                        sx={{ mb: 2, borderRadius: 2 }}
                    >
                        Нет подключения к интернету. Для скачивания даташитов включите интернет.
                    </Alert>
                )}

                {/* Статистика */}
                <Card sx={{ mb: 3, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" spacing={3} sx={{ justifyContent: 'space-around', flexWrap: 'wrap' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#667eea' }}>
                                    {components.length}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Всего компонентов</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#764ba2' }}>
                                    {components.reduce((sum, c) => sum + c.quantity, 0)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Всего на складе</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#f093fb' }}>
                                    {components.filter(c => c.quantity < 10).length}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Мало на складе</Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Таблица */}
                <Paper sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                                    {[
                                        { key: 'name', label: 'Наименование', icon: <CategoryIcon /> },
                                        { key: 'marking', label: 'Маркировка', icon: <DescriptionIcon /> },
                                        { key: 'parameters', label: 'Параметры', icon: <DescriptionIcon /> },
                                        { key: 'imageData', label: 'Вид', icon: <ImageIcon /> },
                                        { key: 'storageCell', label: 'Ячейка', icon: <StorageIcon /> },
                                        { key: 'quantity', label: 'Количество', icon: <InventoryIcon /> },
                                        { key: 'datasheetFileName', label: 'Даташит', icon: <LinkIcon /> },
                                        { key: 'note', label: 'Примечание', icon: <DescriptionIcon /> },
                                        { key: 'actions', label: 'Действия', icon: null },
                                    ].map((col) => (
                                        <TableCell
                                            key={col.key}
                                            onClick={() => col.key !== 'actions' && col.key !== 'imageData' && handleSort(col.key as keyof Component)}
                                            sx={{
                                                cursor: col.key !== 'actions' && col.key !== 'imageData' ? 'pointer' : 'default',
                                                fontWeight: 'bold',
                                                fontSize: '0.95rem',
                                                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                                borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                            }}
                                        >
                                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                {col.icon && <Box sx={{ color: '#667eea', fontSize: 18 }}>{col.icon}</Box>}
                                                <Typography variant="subtitle2">{col.label}</Typography>
                                                {sortColumn === col.key && (
                                                    <Typography variant="caption" sx={{ color: '#667eea' }}>
                                                        {sortDirection === 'asc' ? '↑' : '↓'}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedComponents.map((comp, index) => {
                                    const stockStatus = getStockStatus(comp.quantity);
                                    return (
                                        <TableRow
                                            key={comp.id}
                                            hover
                                            sx={{
                                                '&:hover': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                                    transform: 'translateX(4px)',
                                                    transition: 'all 0.2s ease',
                                                },
                                                animation: `fadeIn 0.3s ease-out ${index * 0.05}s`,
                                                '@keyframes fadeIn': {
                                                    from: { opacity: 0, transform: 'translateY(20px)' },
                                                    to: { opacity: 1, transform: 'translateY(0)' },
                                                },
                                            }}
                                        >
                                            <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer', fontWeight: 500 }}>
                                                {comp.name}
                                            </TableCell>
                                            <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                                                <Chip
                                                    label={comp.marking}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: alpha('#667eea', 0.1),
                                                        color: '#667eea',
                                                        fontWeight: 500,
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>{comp.parameters}</TableCell>
                                            <TableCell>
                                                <ImageThumbnail src={comp.imageData} />
                                            </TableCell>
                                            <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                                                <Chip
                                                    label={comp.storageCell || '—'}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ borderColor: '#764ba2', color: '#764ba2' }}
                                                />
                                            </TableCell>
                                            <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                        {comp.quantity} шт.
                                                    </Typography>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={Math.min((comp.quantity / 200) * 100, 100)}
                                                        sx={{
                                                            mt: 0.5,
                                                            height: 4,
                                                            borderRadius: 2,
                                                            backgroundColor: alpha(stockStatus.color === 'success' ? '#4caf50' :
                                                                stockStatus.color === 'warning' ? '#ff9800' : '#f44336', 0.2),
                                                            '& .MuiLinearProgress-bar': {
                                                                backgroundColor: stockStatus.color === 'success' ? '#4caf50' :
                                                                    stockStatus.color === 'warning' ? '#ff9800' : '#f44336',
                                                            }
                                                        }}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={1}>
                                                    {(comp.datasheetFileName || comp.datasheetUrl) ? (
                                                        <Tooltip title={comp.datasheetFileName ? "Открыть локальный даташит" : "Открыть даташит по ссылке"}>
                                                            <Button
                                                                size="small"
                                                                onClick={() => handleDatasheetClick(comp)}
                                                                startIcon={<PdfIcon />}
                                                                sx={{
                                                                    borderRadius: 2,
                                                                    textTransform: 'none',
                                                                }}
                                                            >
                                                                {comp.datasheetFileName ? "PDF" : "Смотреть"}
                                                            </Button>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title={isOnline ? "Поиск даташита в интернете" : "Нет интернета"}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isOnline) handleSearchDatasheetOnline(comp);
                                                                    else setSnackbar({ open: true, message: 'Нет интернета', severity: 'error' });
                                                                }}
                                                                disabled={!isOnline}
                                                                sx={{ color: '#667eea' }}
                                                            >
                                                                <CloudDownloadIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                                                <Typography variant="body2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                                                    {comp.note}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title="Редактировать">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleEdit(comp)}
                                                        sx={{ color: '#667eea', '&:hover': { backgroundColor: alpha('#667eea', 0.1) } }}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Удалить">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDelete(comp.id!)}
                                                        sx={{ color: '#f44336', '&:hover': { backgroundColor: alpha('#f44336', 0.1) } }}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {paginatedComponents.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                                            <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                                                Нет данных. Добавьте первый компонент!
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        component="div"
                        count={filteredComponents.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
                    />
                </Paper>

                {/* Модальное окно */}
                <Dialog
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    maxWidth="md"
                    fullWidth
                    slotProps={{
                        paper: {
                            sx: { borderRadius: 3 }
                        }
                    }}
                >
                    <DialogTitle sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                    }}>
                        <Typography variant="h5">
                            {editingComponent ? 'Редактирование компонента' : 'Добавление нового компонента'}
                        </Typography>
                    </DialogTitle>
                    <DialogContent dividers sx={{ mt: 2 }}>
                        <Stack spacing={2}>
                            <TextField
                                label="Наименование *"
                                fullWidth
                                value={formData.name || ''}
                                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                required
                            />
                            <TextField
                                label="Маркировка *"
                                fullWidth
                                value={formData.marking || ''}
                                onChange={(e) => setFormData((prev) => ({ ...prev, marking: e.target.value }))}
                                required
                            />
                            <TextField
                                label="Основные параметры"
                                fullWidth
                                multiline
                                rows={2}
                                value={formData.parameters || ''}
                                onChange={(e) => setFormData((prev) => ({ ...prev, parameters: e.target.value }))}
                            />

                            <Box>
                                <Typography variant="subtitle2" gutterBottom>Изображение компонента</Typography>
                                <Button variant="outlined" component="label" startIcon={<ImageIcon />}>
                                    Загрузить фото
                                    <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                                </Button>
                                {formData.imageData && (
                                    <Box sx={{ mt: 1 }}>
                                        <img src={formData.imageData} alt="preview" style={{ maxHeight: 100, maxWidth: '100%', borderRadius: 8 }} />
                                    </Box>
                                )}
                            </Box>

                            <TextField
                                label="Ячейка на складе"
                                fullWidth
                                value={formData.storageCell || ''}
                                onChange={(e) => setFormData((prev) => ({ ...prev, storageCell: e.target.value }))}
                            />
                            <TextField
                                label="Количество"
                                type="number"
                                fullWidth
                                value={formData.quantity || 0}
                                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                            />

                            <Box>
                                <Typography variant="subtitle2" gutterBottom>Даташит</Typography>
                                <Stack direction="row" spacing={2}>
                                    <Button
                                        variant="outlined"
                                        component="label"
                                        startIcon={<UploadIcon />}
                                        disabled={!editingComponent}
                                    >
                                        Загрузить локальный PDF
                                        <input
                                            type="file"
                                            hidden
                                            accept=".pdf"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0] && editingComponent) {
                                                    uploadLocalDatasheet(editingComponent, e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </Button>
                                    {isOnline && editingComponent && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => {
                                                const url = prompt('Введите URL даташита (PDF):');
                                                if (url && editingComponent) {
                                                    downloadDatasheet(editingComponent, url);
                                                }
                                            }}
                                        >
                                            Скачать по URL
                                        </Button>
                                    )}
                                </Stack>
                                {formData.datasheetFileName && (
                                    <Alert severity="info" sx={{ mt: 1 }}>
                                        Локальный даташит: {formData.datasheetFileName}
                                    </Alert>
                                )}
                            </Box>

                            <TextField
                                label="Ссылка на даташит (URL)"
                                fullWidth
                                value={formData.datasheetUrl || ''}
                                onChange={(e) => setFormData((prev) => ({ ...prev, datasheetUrl: e.target.value }))}
                                placeholder="https://example.com/datasheet.pdf"
                            />

                            <TextField
                                label="Примечание"
                                fullWidth
                                multiline
                                rows={2}
                                value={formData.note || ''}
                                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setModalOpen(false)}>Отмена</Button>
                        <Button variant="contained" onClick={handleSaveForm} sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                            },
                            transition: 'all 0.3s ease',
                        }}>
                            Сохранить
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Увеличенное изображение */}
                <Modal
                    open={imageZoomOpen}
                    onClose={() => setImageZoomOpen(false)}
                    closeAfterTransition
                    slots={{ backdrop: Backdrop }}
                    slotProps={{
                        backdrop: {
                            timeout: 500,
                        },
                    }}
                >
                    <Fade in={imageZoomOpen}>
                        <Box sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            bgcolor: 'background.paper',
                            boxShadow: 24,
                            p: 2,
                            borderRadius: 2,
                        }}>
                            <img src={zoomedImage} alt="Увеличенное изображение" style={{ maxWidth: '100%', maxHeight: '80vh' }} />
                        </Box>
                    </Fade>
                </Modal>

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Container>
        </Box>
    );
};

export default App;