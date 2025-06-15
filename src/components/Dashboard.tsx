import { Box, Typography } from '@mui/material';

const Dashboard = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1">
        Welcome to your budget dashboard. Here you'll find an overview of your financial status.
      </Typography>
    </Box>
  );
};

export default Dashboard; 