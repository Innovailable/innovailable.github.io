all: rtc-lib easy-signaling promisify-io rtc-bomber

pull:
	for i in source/*; do cd $$i; git pull origin master; cd ../..; done
	git add source/*

rtc-lib:
	rm -rf $@ && mkdir -p $@
	make -C source/rtc-lib compile min doc
	cp -a source/rtc-lib/doc/* source/rtc-lib/out/*.js $@
	git add -A $@

easy-signaling:
	rm -rf $@ && mkdir -p $@
	make -C source/easy-signaling doc
	cp -a source/easy-signaling/doc/* $@
	git add -A $@

promisify-io:
	rm -rf $@ && mkdir -p $@
	make -C source/$@ doc
	cp -a source/$@/doc/* $@
	git add -A $@

rtc-bomber:
	rm -rf $@ && mkdir -p $@
	SIGNALING_URL=wss://calling.innovailable.eu make -C source/$@
	cp -a source/$@/out/* $@
	git add -A $@

.PHONY: rtc-lib easy-signaling rtc-bomber promisify-io
