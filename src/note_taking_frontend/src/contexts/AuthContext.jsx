import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { createActor, canisterId } from '../../../declarations/note_taking_backend';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authClient, setAuthClient] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [principal, setPrincipal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authenticatedActor, setAuthenticatedActor] = useState(null);

  // Use the correct Internet Identity canister URL for local development
  const identityProvider = 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943';

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      console.log('Initializing auth...');
      console.log('Identity provider:', identityProvider);

      const client = await AuthClient.create({
        idleOptions: {
          disableIdle: true,
          disableDefaultIdleCallback: true
        }
      });
      setAuthClient(client);

      const isAuthenticated = await client.isAuthenticated();
      console.log('Is authenticated:', isAuthenticated);
      setIsAuthenticated(isAuthenticated);

      if (isAuthenticated) {
        const identity = client.getIdentity();
        setIdentity(identity);
        setPrincipal(identity.getPrincipal().toString());
        
        // Create authenticated actor with the correct canister ID
        const actor = createActor(canisterId, {
          agentOptions: {
            identity,
            host: 'http://localhost:4943',
          },
        });
        setAuthenticatedActor(actor);
        console.log('Authenticated actor created successfully');
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      if (!authClient) {
        console.error('Auth client not initialized');
        return;
      }

      console.log('Starting login...');

      await authClient.login({
        identityProvider,
        maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days
        onSuccess: async () => {
          console.log('Login successful');
          const identity = authClient.getIdentity();
          setIdentity(identity);
          setPrincipal(identity.getPrincipal().toString());
          setIsAuthenticated(true);
          
          // Create authenticated actor
          const actor = createActor(canisterId, {
            agentOptions: {
              identity,
              host: 'http://localhost:4943',
            },
          });
          setAuthenticatedActor(actor);
          console.log('Login complete, actor created');
        },
        onError: (error) => {
          console.error('Login error:', error);
        },
      });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    try {
      if (authClient) {
        await authClient.logout();
        setIsAuthenticated(false);
        setIdentity(null);
        setPrincipal(null);
        setAuthenticatedActor(null);
        console.log('Logout successful');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    isAuthenticated,
    identity,
    principal,
    isLoading,
    authenticatedActor,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};