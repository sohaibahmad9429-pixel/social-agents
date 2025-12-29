'use client';

import React, { useState, useEffect } from 'react';
import {
  Facebook,
  Instagram,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  Users,
  Target,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MetaAdsConnectProps {
  onConnect: () => void;
}

interface ConnectionStatus {
  isConnected: boolean;
  canRunAds: boolean;
  tokenExpired?: boolean;
  tokenExpiresSoon?: boolean;
  adAccount?: {
    id: string;
    name: string;
  };
  page?: {
    id: string;
    name: string;
  };
  platforms?: {
    facebook: { isConnected: boolean; pageName?: string };
    instagram: { isConnected: boolean; username?: string };
  };
  missingForAds?: string[];
  message?: string;
}

export default function MetaAdsConnect({ onConnect }: MetaAdsConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'loading' | 'intro' | 'connecting' | 'error' | 'use_existing'>('loading');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  // Check if Facebook is already connected
  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    try {
      const response = await fetch('/api/meta-ads/status');
      const data = await response.json();

      setConnectionStatus(data);

      if (data.isConnected && data.canRunAds) {
        // Already fully connected - trigger onConnect
        onConnect();
      } else if (data.platforms?.facebook?.isConnected) {
        // Facebook connected but may need ad account setup
        setStep('use_existing');
      } else {
        setStep('intro');
      }
    } catch (err) {
      setStep('intro');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    setStep('connecting');

    try {
      const response = await fetch('/api/meta-ads/auth/url');
      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Meta OAuth
        window.location.href = data.url;
      } else {
        // Show error to user
        setError(data.error || 'Failed to start connection. Please try again.');
        setStep('error');
        setIsConnecting(false);
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setStep('error');
      setIsConnecting(false);
    }
  };

  const handleUseExisting = async () => {
    setIsConnecting(true);

    try {
      // Try to fetch ad account using existing Facebook credentials
      const response = await fetch('/api/meta-ads/status');
      const data = await response.json();

      if (data.canRunAds) {
        onConnect();
      } else {
        // Need to connect with ads permissions
        setError(data.missingForAds?.[0] || 'Additional permissions required for ads');
        setStep('intro');
      }
    } catch (err) {
      setError('Failed to verify ad account access');
      setStep('intro');
    } finally {
      setIsConnecting(false);
    }
  };

  // Meta Marketing API v24.0 Features
  const features = [
    {
      icon: Target,
      title: 'Advanced Targeting',
      description: 'Reach ideal audiences - Note: Some interests deprecated Jan 2026',
    },
    {
      icon: BarChart3,
      title: 'v24.0 Analytics',
      description: 'Track Instagram profile visits, ROAS, and conversion metrics',
    },
    {
      icon: Users,
      title: 'Custom & Lookalike',
      description: 'Create audiences with mandatory lookalike_spec format',
    },
    {
      icon: Zap,
      title: 'Advantage+ AI',
      description: 'Automated optimization with unified campaign structure',
    },
  ];

  const permissions = [
    'Manage ad campaigns (v24.0 OUTCOME objectives)',
    'View insights (instagram_profile_visits metric)',
    'Create audiences (lookalike_spec mandatory Jan 2026)',
    'Access Facebook & Instagram Pages',
  ];

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">Checking Connection</h2>
              <p className="text-muted-foreground">
                Verifying your Meta account status...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'use_existing') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Facebook className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-4 border-background">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              </div>

              <h2 className="text-xl font-bold mb-2">Facebook Already Connected</h2>
              <p className="text-muted-foreground mb-4">
                Your Facebook account is connected. We can use it for Meta Ads.
              </p>

              {connectionStatus?.platforms?.facebook?.pageName && (
                <Badge variant="secondary" className="mb-4">
                  <Facebook className="w-3 h-3 mr-1" />
                  {connectionStatus.platforms.facebook.pageName}
                </Badge>
              )}

              {connectionStatus?.adAccount?.name && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6 w-full">
                  <p className="text-sm text-muted-foreground">Ad Account</p>
                  <p className="font-semibold">{connectionStatus.adAccount.name}</p>
                </div>
              )}

              {connectionStatus?.missingForAds && connectionStatus.missingForAds.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 w-full">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-left">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Additional Setup Needed</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">{connectionStatus.missingForAds[0]}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 w-full">
                <Button
                  onClick={handleUseExisting}
                  disabled={isConnecting}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Use This Account
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconnect
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'connecting') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Facebook className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center border-4 border-background">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
              </div>
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">Connecting to Meta</h2>
              <p className="text-muted-foreground">
                Please wait while we establish a secure connection...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
              <p className="text-muted-foreground mb-4">
                {error}
              </p>
              <Button onClick={() => { setStep('intro'); setError(null); }}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Facebook className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center border-2 border-background">
                <Instagram className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Connect Meta Ads Manager
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Manage your Facebook and Instagram advertising campaigns with our powerful,
            enterprise-grade ads management platform.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="pt-6">
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Connect Card */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Get Started</CardTitle>
            <CardDescription>
              Connect your Meta Business account to start managing ads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Permissions */}
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-primary" />
                <span className="font-medium">Required Permissions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {permissions.map((permission, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground">{permission}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connect Button */}
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full h-12 text-base gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Facebook className="w-5 h-5" />
                  Connect with Meta
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By connecting, you agree to Meta's Terms of Service and authorize access to your ad accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

