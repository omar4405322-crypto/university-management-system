import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-bg-page p-4">
      <Card className="w-full max-w-md bg-brand-bg-card border-brand-border">
        <CardContent className="pt-6 text-center">
          <div className="flex flex-col items-center mb-4 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-rose-500" />
            </div>
            <h1 className="text-2xl font-black text-brand-text-primary">
              {t('common.pageNotFound', '404 Page Not Found')}
            </h1>
          </div>

          <p className="mt-2 text-sm text-brand-text-secondary leading-relaxed mb-6">
            {t('common.pageNotFoundDesc', 'The page you are looking for does not exist or has been moved.')}
          </p>

          <Link to="/">
            <Button className="flex items-center gap-2 mx-auto">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              <span>{t('common.backToHome', 'Back to Home')}</span>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
