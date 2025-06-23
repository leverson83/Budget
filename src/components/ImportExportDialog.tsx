import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AccountBalance as AccountIcon,
  AttachMoney as IncomeIcon,
  AccountBalanceWallet as ExpenseIcon,
  LocalOffer as TagIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { apiCall } from '../utils/api';

interface ImportExportDialogProps {
  open: boolean;
  onClose: () => void;
  onDataChange: () => void;
}

interface Version {
  id: number;
  name: string;
  is_active: number;
}

const ImportExportDialog: React.FC<ImportExportDialogProps> = ({ 
  open, 
  onClose, 
  onDataChange 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importData, setImportData] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [versionName, setVersionName] = useState('Imported Version');
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | ''>('');

  // Fetch available versions when dialog opens
  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open]);

  const fetchVersions = async () => {
    try {
      const response = await apiCall('/versions');
      if (response.ok) {
        const versionsData = await response.json();
        setVersions(versionsData);
        // Set default to active version
        const activeVersion = versionsData.find((v: Version) => v.is_active === 1);
        if (activeVersion) {
          setSelectedVersionId(activeVersion.id);
        }
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Build the export URL with version ID if selected
      let exportUrl = '/export';
      if (selectedVersionId !== '') {
        exportUrl += `?versionId=${selectedVersionId}`;
      }

      const response = await apiCall(exportUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const data = await response.json();
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Data exported successfully!');
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setSuccess('');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.version && (data.accounts || data.income || data.expenses || data.tags || data.settings)) {
            setImportData(data);
          } else {
            setError('Invalid file format. Please select a valid budget export file.');
            setSelectedFile(null);
          }
        } catch (err) {
          setError('Invalid JSON file. Please select a valid budget export file.');
          setSelectedFile(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!importData) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Update the import data with the custom version name
      const importDataWithCustomName = {
        ...importData,
        version: {
          ...importData.version,
          name: versionName.trim() || 'Imported Version'
        }
      };

      const response = await apiCall('/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importDataWithCustomName),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const result = await response.json();
      setSuccess(`Import completed successfully! Imported: ${result.imported.accounts} accounts, ${result.imported.income} income items, ${result.imported.expenses} expenses, ${result.imported.tags} tags, ${result.imported.settings} settings`);
      
      // Refresh data
      onDataChange();
      
      setTimeout(() => {
        onClose();
        setSuccess('');
        setImportData(null);
        setSelectedFile(null);
        setVersionName('Imported Version');
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setSuccess('');
      setImportData(null);
      setSelectedFile(null);
      setVersionName('Imported Version');
      onClose();
    }
  };

  const getDataSummary = (data: any) => {
    if (!data) return null;
    
    return [
      { icon: <AccountIcon />, label: 'Accounts', count: data.accounts?.length || 0 },
      { icon: <IncomeIcon />, label: 'Income', count: data.income?.length || 0 },
      { icon: <ExpenseIcon />, label: 'Expenses', count: data.expenses?.length || 0 },
      { icon: <TagIcon />, label: 'Tags', count: data.tags?.length || 0 },
      { icon: <SettingsIcon />, label: 'Settings', count: data.settings?.length || 0 },
    ];
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import / Export Budget Data</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Export Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <DownloadIcon sx={{ mr: 1 }} />
            Export Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Export your budget data as a JSON file. This includes all accounts, income, expenses, tags, and settings.
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="version-select-label">Version to Export</InputLabel>
            <Select
              labelId="version-select-label"
              value={selectedVersionId}
              label="Version to Export"
              onChange={(e) => setSelectedVersionId(e.target.value as number)}
            >
              {versions.map((version) => (
                <MenuItem key={version.id} value={version.id}>
                  {version.name} {version.is_active === 1 ? '(Active)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleExport}
            disabled={loading}
            fullWidth
          >
            {loading ? 'Exporting...' : 'Export Data'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Import Section */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <UploadIcon sx={{ mr: 1 }} />
            Import Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Import budget data from a previously exported JSON file. This will create a new version with the imported data.
          </Typography>

          <input
            accept=".json"
            style={{ display: 'none' }}
            id="import-file-input"
            type="file"
            onChange={handleFileSelect}
          />
          <label htmlFor="import-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              disabled={loading}
              fullWidth
              sx={{ mb: 2 }}
            >
              Select File
            </Button>
          </label>

          {selectedFile && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Selected: {selectedFile.name}
            </Typography>
          )}

          {importData && (
            <>
              <TextField
                fullWidth
                label="Version Name"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Enter a name for the imported version"
                sx={{ mb: 2 }}
                helperText="This will be the name of the new version created from the imported data"
              />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Import Summary:
                </Typography>
                <List dense>
                  {getDataSummary(importData)?.map((item, index) => (
                    <ListItem key={index} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${item.label}: ${item.count}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          )}

          {importData && (
            <Button
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={16} /> : <UploadIcon />}
              onClick={handleImport}
              disabled={loading}
              fullWidth
            >
              {loading ? 'Importing...' : 'Import Data'}
            </Button>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportExportDialog; 