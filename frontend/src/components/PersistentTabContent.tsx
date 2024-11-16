import React from 'react';

interface PersistentTabContentProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const PersistentTabContent: React.FC<PersistentTabContentProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      style={{ 
        display: value === index ? 'block' : 'none',
        height: '100%' 
      }}
    >
      {children}
    </div>
  );
};

export default PersistentTabContent; 