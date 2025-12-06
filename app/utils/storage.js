'use client';

export const saveCampaign = (campaign) => {
  const campaigns = JSON.parse(localStorage.getItem('campaigns') || '[]');
  campaigns.push({
    ...campaign,
    id: Date.now(),
    createdAt: new Date().toISOString()
  });
  localStorage.setItem('campaigns', JSON.stringify(campaigns));
};

export const getCampaigns = () => {
  return JSON.parse(localStorage.getItem('campaigns') || '[]');
}; 