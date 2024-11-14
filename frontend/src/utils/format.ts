export const shortenAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
}; 