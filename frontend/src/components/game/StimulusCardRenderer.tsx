import React from 'react';
import { Stimulus, ElementId, ClassificationStatus, InvestigationData } from '../../types';
import { 
  ArrowLeft, Phone, Video, MoreVertical, 
  ChevronLeft, Info, Search, Menu, 
  MoreHorizontal, Star, Reply, User, Mail
} from 'lucide-react';
import { cn } from '../ui/Button';

interface InvestigateableProps {
  id: ElementId;
  children: React.ReactNode;
  onElementClick?: (id: ElementId) => void;
  investigation?: InvestigationData;
  className?: string;
  showResults?: boolean;
  actualStatus?: boolean; // isSuspicious from data
  isHighlighted?: boolean; // Tutorial: pulsing glow to draw attention
}

const InvestigateableElement: React.FC<InvestigateableProps> = ({ 
  id, children, onElementClick, investigation, className, showResults, actualStatus, isHighlighted 
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onElementClick) {
      onElementClick(id);
    }
  };

  let borderClass = "border-transparent";
  let bgClass = "";

  if (showResults) {
    if (actualStatus) {
      // It was suspicious. Did they catch it?
      if (investigation?.status === 'SUSPICIOUS') {
        borderClass = "border-green-500 ring-2 ring-green-500/50";
        bgClass = "bg-green-500/10";
      } else {
        // Missed it
        borderClass = "border-red-500 ring-2 ring-red-500/50";
        bgClass = "bg-red-500/10";
      }
    } else {
      // It was safe
      if (investigation?.status === 'SUSPICIOUS') {
        // False alarm
        borderClass = "border-red-500 ring-2 ring-red-500/50";
        bgClass = "bg-red-500/10";
      } else if (investigation?.status === 'SAFE') {
        borderClass = "border-green-500 ring-2 ring-green-500/50";
      }
    }
  } else if (investigation) {
    if (investigation.status === 'SUSPICIOUS') borderClass = "border-red-400";
    if (investigation.status === 'SAFE') borderClass = "border-green-400";
    if (investigation.status === 'NOT_SURE') borderClass = "border-yellow-400";
  }

  return (
    <div 
      onClick={handleClick}
      className={cn(
        "cursor-pointer transition-all border-2 rounded-md hover:ring-2 hover:ring-indigo-400/50 relative overflow-visible pointer-events-auto",
        borderClass,
        bgClass,
        isHighlighted && "border-cyan-400 ring-2 ring-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.5)]",
        className
      )}
      style={isHighlighted ? { animation: 'tutorial-pulse 2s ease-in-out infinite' } : undefined}
    >
      {children}
      {showResults && (
         <div className="absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/10 text-xs z-10 font-bold">
           {actualStatus ? '⚠' : '✓'}
         </div>
      )}
    </div>
  );
};

interface BaseCardProps {
  stimulus: Stimulus;
  onElementClick?: (id: ElementId) => void;
  investigations: Partial<Record<ElementId, InvestigationData>>;
  showResults?: boolean;
  tutorialHighlightSender?: boolean;
}

const WhatsAppCard = ({ stimulus, onElementClick, investigations, showResults, tutorialHighlightSender }: BaseCardProps) => {
  return (
    <div className="w-full h-full bg-[#E5DDD5] flex flex-col font-sans relative overflow-hidden select-none text-slate-800">
      <div className="bg-[#075E54] text-white px-3 py-3 flex items-center justify-between shadow-md z-10 w-full mb-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <ArrowLeft className="w-5 h-5 opacity-90" />
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
             <User className="w-6 h-6 opacity-60 mt-1" />
          </div>
          <InvestigateableElement id="sender" onElementClick={onElementClick} investigation={investigations['sender']} showResults={showResults} actualStatus={stimulus.sender.isSuspicious} isHighlighted={tutorialHighlightSender} className="flex flex-col ml-1 px-1 -mx-1">
            <span className="font-semibold text-[15px] leading-tight truncate max-w-[140px]">{stimulus.sender.text}</span>
            <span className="text-[13px] text-white/80">online</span>
          </InvestigateableElement>
        </div>
        <div className="flex items-center gap-4 opacity-90">
          <Video className="w-5 h-5" />
          <Phone className="w-5 h-5" />
          <MoreVertical className="w-5 h-5" />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col justify-end pb-4">
        <div className="self-center bg-[#E1F3FB] text-slate-600 text-[13px] px-3 py-1 rounded-lg mb-3 shadow-sm uppercase shadow-black/5 pointer-events-none">
          Today
        </div>

        <div className="relative bg-white p-1 pb-4 rounded-xl rounded-tl-sm self-start shadow-[0_1px_1px_rgba(0,0,0,0.1)] max-w-[85%] mt-1 text-[15px] leading-[1.35rem]">
          <InvestigateableElement id="content" onElementClick={onElementClick} investigation={investigations['content']} showResults={showResults} actualStatus={stimulus.content?.isSuspicious} className="p-1 px-2 whitespace-pre-wrap word-break">
            {stimulus.content?.text}
          </InvestigateableElement>
          
          {stimulus.actionUrl && (
             <InvestigateableElement id="actionUrl" onElementClick={onElementClick} investigation={investigations['actionUrl']} showResults={showResults} actualStatus={stimulus.actionUrl.isSuspicious} className="mt-2 px-2 text-blue-500 underline break-all">
                {stimulus.actionUrl.text}
             </InvestigateableElement>
          )}
          <div className="absolute right-2 bottom-1 text-[12px] text-slate-400 font-medium pointer-events-none">
            11:42 am
          </div>
        </div>
      </div>
    </div>
  );
};

const SMSCard = ({ stimulus, onElementClick, investigations, showResults, tutorialHighlightSender }: BaseCardProps) => {
  return (
    <div className="w-full h-full bg-white flex flex-col font-sans relative overflow-hidden select-none text-slate-800">
      <div className="bg-slate-50 border-b border-slate-200 px-2 py-2 flex items-center justify-between pb-3 pt-6 z-10 w-full pointer-events-none">
        <div className="flex items-center text-blue-500 -ml-1">
          <ChevronLeft className="w-7 h-7" />
          <span className="text-[17px] -ml-1">Filters</span>
        </div>
        <InvestigateableElement id="sender" onElementClick={onElementClick} investigation={investigations['sender']} showResults={showResults} actualStatus={stimulus.sender.isSuspicious} isHighlighted={tutorialHighlightSender} className="flex flex-col items-center flex-1 -ml-4 px-2">
          <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center mb-1 overflow-hidden text-white font-bold text-lg">
             {stimulus.sender.text.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-[13px] text-slate-900 leading-none">{stimulus.sender.text}</span>
        </InvestigateableElement>
      </div>

      <div className="flex-1 p-4 flex flex-col justify-end bg-white pb-4">
        <div className="bg-[#E9E9EB] text-black p-2 pb-3 rounded-2xl rounded-bl-sm self-start max-w-[85%] text-[15px] leading-relaxed">
          <InvestigateableElement id="content" onElementClick={onElementClick} investigation={investigations['content']} showResults={showResults} actualStatus={stimulus.content?.isSuspicious} className="px-2 pt-1 whitespace-pre-wrap">
             {stimulus.content?.text}
          </InvestigateableElement>
          {stimulus.actionUrl && (
             <InvestigateableElement id="actionUrl" onElementClick={onElementClick} investigation={investigations['actionUrl']} showResults={showResults} actualStatus={stimulus.actionUrl.isSuspicious} className="mt-2 text-blue-600 underline break-all font-medium px-2">
                {stimulus.actionUrl.text}
             </InvestigateableElement>
          )}
        </div>
      </div>
    </div>
  );
};

const EmailCard = ({ stimulus, onElementClick, investigations, showResults, tutorialHighlightSender }: BaseCardProps) => {
  return (
    <div className="w-full h-full bg-white flex flex-col font-sans relative overflow-hidden select-none text-slate-800">
      <div className="bg-white border-b border-slate-100 flex items-center gap-4 px-4 py-4 pt-6 z-10 w-full shadow-sm pointer-events-none">
        <ArrowLeft className="w-6 h-6 text-slate-600" />
        <div className="flex gap-4 ml-auto text-slate-600">
          <Mail className="w-5 h-5" />
          <MoreVertical className="w-5 h-5" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white flex flex-col pt-2 pb-4">
         <div className="px-4 py-2 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-lg shrink-0 pointer-events-none">
               {stimulus.sender.text.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
               <InvestigateableElement id="sender" onElementClick={onElementClick} investigation={investigations['sender']} showResults={showResults} actualStatus={stimulus.sender.isSuspicious} isHighlighted={tutorialHighlightSender} className="flex flex-col w-full px-1">
                  <div className="font-bold text-slate-800 text-[15px] truncate">{stimulus.sender.text.split('@')[0]}</div>
                  <div className="text-xs text-slate-500 truncate">{stimulus.sender.text}</div>
               </InvestigateableElement>
            </div>
         </div>

         <div className="px-4 py-4 text-[15px] leading-relaxed text-slate-800 mt-2">
           <InvestigateableElement id="content" onElementClick={onElementClick} investigation={investigations['content']} showResults={showResults} actualStatus={stimulus.content?.isSuspicious} className="whitespace-pre-wrap px-1 block">
             {stimulus.content?.text}
           </InvestigateableElement>
           
           {stimulus.actionUrl && (
              <InvestigateableElement id="actionUrl" onElementClick={onElementClick} investigation={investigations['actionUrl']} showResults={showResults} actualStatus={stimulus.actionUrl.isSuspicious} className="mt-8 mb-4 px-1 block text-blue-600 underline break-all">
                {stimulus.actionUrl.text}
              </InvestigateableElement>
           )}
         </div>
      </div>
    </div>
  );
};

const UPICard = ({ stimulus, onElementClick, investigations, showResults, tutorialHighlightSender }: BaseCardProps) => {
  return (
    <div className="w-full h-full bg-white flex flex-col font-sans relative overflow-hidden select-none text-slate-800">
      <div className="bg-white flex items-center gap-4 px-4 py-4 pt-6 z-10 w-full shadow-sm border-b border-slate-100 pointer-events-none">
        <ArrowLeft className="w-6 h-6 text-slate-600" />
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col items-center pt-5 px-6 pb-5">
         <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-3xl mb-4 border border-indigo-200 pointer-events-none">
             {stimulus.sender.text.charAt(0).toUpperCase()}
         </div>
         
         <InvestigateableElement id="sender" onElementClick={onElementClick} investigation={investigations['sender']} showResults={showResults} actualStatus={stimulus.sender.isSuspicious} isHighlighted={tutorialHighlightSender} className="flex flex-col items-center px-4 w-full">
           <div className="font-semibold text-lg text-slate-900 w-full text-center">{stimulus.sender.text.split('@')[0]}</div>
           <div className="text-slate-500 text-sm mb-6">{stimulus.sender.text}</div>
         </InvestigateableElement>

         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full p-4 flex flex-col items-center relative overflow-hidden mt-4">
            <div className="absolute top-0 left-0 right-0 bg-blue-50/50 py-1.5 text-center text-xs font-semibold text-blue-600 tracking-wider pointer-events-none">
               PAYMENT REQUEST
            </div>
            
            <div className="mt-8 text-black/60 text-sm font-medium pointer-events-none">Requested</div>
            <InvestigateableElement id="amount" onElementClick={onElementClick} investigation={investigations['amount']} showResults={showResults} actualStatus={stimulus.amount?.isSuspicious} className="text-5xl font-black text-slate-900 mt-1 mb-4 tracking-tight px-2">
               {stimulus.amount?.text || '₹---'}
            </InvestigateableElement>

            <InvestigateableElement id="content" onElementClick={onElementClick} investigation={investigations['content']} showResults={showResults} actualStatus={stimulus.content?.isSuspicious} className="bg-yellow-50 text-yellow-800 text-xs px-3 py-1.5 rounded-md font-medium text-center w-full mb-6 italic">
              "{stimulus.content?.text}"
            </InvestigateableElement>
         </div>
      </div>
    </div>
  );
};

const SocialCard = ({ stimulus, onElementClick, investigations, showResults, tutorialHighlightSender }: BaseCardProps) => {
  return (
    <div className="w-full h-full bg-slate-900 flex flex-col font-sans relative overflow-hidden select-none text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 pt-6 flex items-center justify-between shadow-md z-10 w-full pointer-events-none">
        <ArrowLeft className="w-6 h-6 text-slate-300" />
        <div className="font-bold text-lg text-slate-200">Messages</div>
        <MoreHorizontal className="w-6 h-6 text-slate-300" />
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-900 flex flex-col pt-3 pb-4">
         <div className="px-4 py-2 flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xl shrink-0 pointer-events-none">
               {stimulus.sender.text.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
               <InvestigateableElement id="sender" onElementClick={onElementClick} investigation={investigations['sender']} showResults={showResults} actualStatus={stimulus.sender.isSuspicious} isHighlighted={tutorialHighlightSender} className="flex flex-col w-full px-1">
                  <div className="font-bold text-[16px] text-white flex items-center gap-1">{stimulus.sender.text.split('@')[0]} <span className="w-3 h-3 bg-blue-500 rounded-full inline-block"></span></div>
                  <div className="text-sm text-slate-400 truncate">{stimulus.sender.text}</div>
               </InvestigateableElement>
            </div>
         </div>

         <div className="px-4 py-6 text-[15px] leading-relaxed text-slate-200">
           <InvestigateableElement id="content" onElementClick={onElementClick} investigation={investigations['content']} showResults={showResults} actualStatus={stimulus.content?.isSuspicious} className="whitespace-pre-wrap px-2 py-3 bg-slate-800 rounded-xl rounded-tl-sm inline-block max-w-[90%]">
             {stimulus.content?.text}
           </InvestigateableElement>
           
           {stimulus.actionUrl && (
              <InvestigateableElement id="actionUrl" onElementClick={onElementClick} investigation={investigations['actionUrl']} showResults={showResults} actualStatus={stimulus.actionUrl.isSuspicious} className="mt-4 px-3 py-2 bg-slate-800 rounded-xl inline-block text-blue-400 underline break-all max-w-[90%]">
                {stimulus.actionUrl.text}
              </InvestigateableElement>
           )}
         </div>
      </div>
    </div>
  );
};

interface Props {
  stimulus: Stimulus;
  onElementClick?: (id: ElementId) => void;
  investigations?: Partial<Record<ElementId, InvestigationData>>;
  showResults?: boolean;
  tutorialHighlightSender?: boolean; // Tutorial: highlight the sender element
}

export const StimulusCardRenderer: React.FC<Props> = ({ stimulus, onElementClick, investigations = {} as any, showResults, tutorialHighlightSender }) => {
  return (
    <div className="w-full h-full bg-white flex flex-col relative">
      <style>{`
        @keyframes tutorial-pulse {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(6, 182, 212, 0.6); }
          50% { box-shadow: 0 0 20px 6px rgba(6, 182, 212, 0.3); }
        }
      `}</style>
      {stimulus.type === 'WHATSAPP' && <WhatsAppCard stimulus={stimulus} onElementClick={onElementClick} investigations={investigations} showResults={showResults} tutorialHighlightSender={tutorialHighlightSender} />}
      {stimulus.type === 'SMS' && <SMSCard stimulus={stimulus} onElementClick={onElementClick} investigations={investigations} showResults={showResults} tutorialHighlightSender={tutorialHighlightSender} />}
      {stimulus.type === 'EMAIL' && <EmailCard stimulus={stimulus} onElementClick={onElementClick} investigations={investigations} showResults={showResults} tutorialHighlightSender={tutorialHighlightSender} />}
      {stimulus.type === 'UPI' && <UPICard stimulus={stimulus} onElementClick={onElementClick} investigations={investigations} showResults={showResults} tutorialHighlightSender={tutorialHighlightSender} />}
      {stimulus.type === 'SOCIAL' && <SocialCard stimulus={stimulus} onElementClick={onElementClick} investigations={investigations} showResults={showResults} tutorialHighlightSender={tutorialHighlightSender} />}
    </div>
  );
};
