import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // Absolute URLs, or ones already prefixed (e.g. photo URLs built from apiUrl), pass through.
  if (req.url.startsWith('http') || (environment.apiUrl && req.url.startsWith(environment.apiUrl))) {
    return next(req);
  }

  const apiReq = req.clone({
    url: `${environment.apiUrl}${req.url}`,
    setHeaders: {
      Accept: 'application/json',
      // Authorization: `Bearer ${token}`,  // add when auth exists
    },
  });

  return next(apiReq);
};