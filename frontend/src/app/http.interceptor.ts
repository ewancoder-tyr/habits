import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { AuthService } from './auth.service';

export function httpInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
    const tokenPromise = inject(AuthService).getToken();
    const tokenObservable = fromPromise(tokenPromise);

    console.log('HTTP interceptor working.');

    return tokenObservable.pipe(
        switchMap(token => {
            const newReq = req.clone({
                headers: req.headers.append('Authorization', `Bearer ${token}`),
                withCredentials: true
            });

            return next(newReq);
        })
    );
}
