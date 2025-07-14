import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { createActor } from '../../../declarations/note_taking_backend';
import { canisterId } from '../../../declarations/note_taking_backend/index.js';

const AuthContext = createContext();

const network = process.env.DFX_NETWORK;
const identityProvider =
  network === 'ic'
    ? 'https://identity.ic0.app' // Mainnet
    : 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943'; // Local

export const AuthProvider = ({ children }) => {
  const [authClient, setAuthClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState('');
  const [authenticatedActor, setAuthenticatedActor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth client
  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      setIsLoading(true);
      const client = await AuthClient.create();
      setAuthClient(client);
      
      const isAuth = await client.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        await updateActor(client);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateActor = async (client = authClient) => {
    if (!client) return;
    
    try {
      const identity = client.getIdentity();
      const actor = createActor(canisterId, {
        agentOptions: {
          identity
        }
      });
      
      setAuthenticatedActor(actor);
      
      // Get the principal
      const principalResult = await actor.get_caller_principal();
      setPrincipal(principalResult.toString());
    } catch (error) {
      console.error('Error updating actor:', error);
    }
  };

  const login = async () => {
    if (!authClient) return;
    
    try {
      await authClient.login({
        identityProvider,
        onSuccess: async () => {
          setIsAuthenticated(true);
          await updateActor();
        }
      });
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  const logout = async () => {
    if (!authClient) return;
    
    try {
      await authClient.logout();
      setIsAuthenticated(false);
      setPrincipal('');
      setAuthenticatedActor(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const value = {
    isAuthenticated,
    principal,
    authenticatedActor,
    isLoading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


  