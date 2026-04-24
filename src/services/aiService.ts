export interface AIContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export const aiService = {
  async askStudentTutor(prompt: string, images?: AIContentPart[]): Promise<string> {
    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, images })
      });
      
      const data = await response.json();
      if (!data.success) {
        return data.text || "I'm sorry, I couldn't generate an answer at this time.";
      }
      return data.text;
    } catch (error) {
      console.error("AI Error:", error);
      return "Oops! Something went wrong while connecting to the AI server.";
    }
  }
};
