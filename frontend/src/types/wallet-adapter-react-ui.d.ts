declare module '@solana/wallet-adapter-react-ui' {
    import { FC } from 'react';
    
    export const WalletModalProvider: FC<{children: React.ReactNode}>;
    export const WalletMultiButton: FC;
    
    export interface WalletModalProviderProps {
        children: React.ReactNode;
    }
}
