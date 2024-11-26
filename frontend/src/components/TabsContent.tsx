import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import TransactionLog from './TransactionLog';
import LPTracking from './LPTracking';
import MyHoldings from './MyHoldings';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            {...other}
            style={{ height: '100%' }}
        >
            {value === index && (
                <Box sx={{ height: '100%', p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `tab-${index}`,
        'aria-controls': `tabpanel-${index}`,
    };
}

const TabsContent: React.FC = () => {
    const [value, setValue] = useState(0);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    return (
        <Box sx={{ width: '100%', height: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                    value={value} 
                    onChange={handleChange} 
                    aria-label="basic tabs example"
                >
                    <Tab label="Transactions" {...a11yProps(0)} />
                    <Tab label="LP Tracking" {...a11yProps(1)} />
                    <Tab label="My Holdings" {...a11yProps(2)} />
                </Tabs>
            </Box>
            <TabPanel value={value} index={0}>
                <TransactionLog />
            </TabPanel>
            <TabPanel value={value} index={1}>
                <LPTracking />
            </TabPanel>
            <TabPanel value={value} index={2}>
                <MyHoldings />
            </TabPanel>
        </Box>
    );
};

export default TabsContent;
