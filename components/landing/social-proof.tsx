import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SocialProof() {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Marketing Director",
      company: "FashionForward",
      image: "/testimonials/sarah.jpg",
      content: "Found 500+ fashion influencers in 2 hours. The bio extraction saved us weeks of manual research.",
      metrics: "500+ influencers discovered",
      verified: true
    },
    {
      name: "Marcus Rodriguez", 
      role: "Brand Manager",
      company: "TechStartup Inc",
      image: "/testimonials/marcus.jpg",
      content: "The email extraction feature is game-changing. We went from 5% to 40% influencer response rate.",
      metrics: "40% response rate achieved",
      verified: true
    },
    {
      name: "Emma Thompson",
      role: "Social Media Manager", 
      company: "BeautyBrand",
      image: "/testimonials/emma.jpg",
      content: "Multi-platform search across TikTok, Instagram, and YouTube in one place. Absolute time-saver.",
      metrics: "3 platforms, 1 dashboard",
      verified: true
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Trusted by 1000+ Brands</h2>
        <p className="text-gray-600">See how companies discover and connect with influencers faster</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {testimonials.map((testimonial, index) => (
          <Card key={index} className="h-full">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4 mb-4">
                <img 
                  src={testimonial.image} 
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold">{testimonial.name}</h4>
                    {testimonial.verified && (
                      <Badge variant="secondary" className="text-xs">Verified</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-sm text-gray-500">{testimonial.company}</p>
                </div>
              </div>
              
              <blockquote className="text-gray-700 mb-4 italic">
                "{testimonial.content}"
              </blockquote>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-700">{testimonial.metrics}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="text-center mt-12">
        <div className="flex justify-center items-center space-x-8 text-gray-500">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">10,000+</div>
            <div className="text-sm">Influencers Found</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">85%</div>
            <div className="text-sm">Time Saved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">50+</div>
            <div className="text-sm">Enterprise Clients</div>
          </div>
        </div>
      </div>
    </div>
  );
}